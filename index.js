// MQTT GarageDoor Accessory plugin for HomeBridge
//
// Remember to add accessory to config.json. Example:
// "accessories": [
//     {
//            "accessory": "mqttgaragedoor",
//            "name": "PUT THE NAME OF YOUR SWITCH HERE",
//            "url": "PUT URL OF THE BROKER HERE",
//			  "username": "PUT USERNAME OF THE BROKER HERE",
//            "password": "PUT PASSWORD OF THE BROKER HERE"
//			  "type": "PUT ACCESSORY TYPE HERE" ( light|switch )
// 			  "caption": "PUT THE LABEL OF YOUR SWITCH HERE",
// 			  "topics": {
// 				"statusGet": 	"PUT THE MQTT TOPIC FOR THE GETTING THE STATUS OF YOUR SWITCH HERE",
// 				"statusSet": 	"PUT THE MQTT TOPIC FOR THE SETTING THE STATUS OF YOUR SWITCH HERE"
// 			  }
//     }
// ],
//
// When you attempt to add a device, it will ask for a "PIN code".
// The default code for all HomeBridge accessories is 031-45-154.

'use strict';

var Service, Characteristic, DoorState;
var mqtt = require("mqtt");


function MqttGarageDoorAccessory(log, config) {
  	this.log          	= log;
  	this.name 			= config["name"];
  	this.url 			= config["url"];
	this.client_Id 		= 'mqttjs_' + Math.random().toString(16).substr(2, 8);
	this.options = {
	    keepalive: 10,
    	clientId: this.client_Id,
	    protocolId: 'MQTT',
    	protocolVersion: 4,
    	clean: true,
    	reconnectPeriod: 1000,
    	connectTimeout: 30 * 1000,
		will: {
			topic: 'WillMsg',
			payload: 'Connection Closed abnormally..!',
			qos: 0,
			retain: false
		},
	    username: config["username"],
	    password: config["password"],
    	rejectUnauthorized: false
	};
	this.caption		= config["caption"];
	this.topicStatusGet	= config["topics"].statusGet;
	this.topicStatusSet	= config["topics"].statusSet;

	this.doorPollInMs = 4000;
	this.doorOpensInSeconds = 20;

	this.switchStatus = false;
	
	this.garageDoorOpener = new Service.GarageDoorOpener(this.name);

	this.currentDoorState = this.garageDoorOpener.getCharacteristic(Characteristic.DoorState);
    	this.currentDoorState.on('get', this.getState.bind(this));
	this.targetDoorState = this.garageDoorOpener.getCharacteristic(Characteristic.TargetDoorState);
    	this.targetDoorState.on('set', this.setState.bind(this));
    	this.targetDoorState.on('get', this.getTargetState.bind(this));

	var isClosed = this.isClosed();
    	this.currentDoorState.setValue(isClosed ? DoorState.CLOSED : DoorState.OPEN);
    	this.targetDoorState.setValue(isClosed ? DoorState.CLOSED : DoorState.OPEN);

    	this.infoService = new Service.AccessoryInformation();
    	this.infoService
      	   .setCharacteristic(Characteristic.Manufacturer, "Opensource Community")
           .setCharacteristic(Characteristic.Model, "MQTT GarageDoor")
           .setCharacteristic(Characteristic.SerialNumber, "Version 0.0.0");
  

	// connect to MQTT broker
	this.client = mqtt.connect(this.url, this.options);
	var that = this;
	this.client.on('error', function () {
		that.log('Error event on MQTT');
	});

	this.client.on('message', function (topic, message) {
		if (topic == that.topicStatusGet) {
			var status = message.toString();
			that.switchStatus = (status == "true" ? true : false);
		   	that.service.getCharacteristic(Characteristic.DoorState).setValue(that.switchStatus, undefined, 'fromSetValue');
		}
	});
    	
	this.client.subscribe(this.topicStatusGet);

    	this.wasClosed = isClosed;
    	this.operating = false;
    	setTimeout(this.monitorDoorState.bind(this), this.doorPollInMs);
}

module.exports = function(homebridge) {
  	Service = homebridge.hap.Service;
  	Characteristic = homebridge.hap.Characteristic;
	DoorState = homebridge.hap.Characteristic.CurrentDoorState;
  
  	homebridge.registerAccessory("homebridge-mqttgaragedoor", "mqttgaragedoor", MqttGarageDoorAccessory);
}

MqttGarageDoorAccessory.prototype = {

  	monitorDoorState: function() {
     		var isClosed = this.isClosed();
     		if (isClosed != this.wasClosed) {
       			this.wasClosed = isClosed;
       			var state = isClosed ? DoorState.CLOSED : DoorState.OPEN;       
       			this.log("Door state changed to " + (isClosed ? "CLOSED" : "OPEN"));
       			if (!this.operating) {
         			this.currentDoorState.setValue(state);
         			this.targetDoorState.setValue(state);
         			this.targetState = state;
       			}
     		}
     		setTimeout(this.monitorDoorState.bind(this), this.doorPollInMs);
  	},
	
	getState: function(callback) {
    		var isClosed = this.isClosed();
    		this.log("GarageDoor is " + (isClosed ? "CLOSED ("+DoorState.CLOSED+")" : "OPEN ("+DoorState.OPEN+")")); 
    		callback(null, (isClosed ? DoorState.CLOSED : DoorState.OPEN));
	},

	setState: function(status, callback, context) {
		if(context !== 'fromSetValue') {
    			this.log("Setting state to " + status);
    			this.targetState = status;
    			var isClosed = this.isClosed();
    			if ((status == DoorState.OPEN && isClosed) || (status == DoorState.CLOSED && !isClosed)) {
        			this.log("Triggering GarageDoor Relay");
        			this.operating = true; 
        			if (status == DoorState.OPEN) {
            				this.currentDoorState.setValue(DoorState.OPENING);
        			} else {
            				this.currentDoorState.setValue(DoorState.CLOSING);
        			}
	    			// this.switchStatus = status;
				setTimeout(this.setFinalDoorState.bind(this), this.doorOpensInSeconds * 1000);
	    			this.client.publish(this.topicStatusSet, status ? "true" : "false");
			}
		} 
		callback();
	},

	isClosed: function() {
		return(this.switchStatus);
 	},

	setFinalDoorState: function() {
    		var isClosed = this.isClosed();
    		if ((this.targetState == DoorState.CLOSED && !isClosed) || (this.targetState == DoorState.OPEN && isClosed)) {
      			this.log("Was trying to " + (this.targetState == DoorState.CLOSED ? " CLOSE " : " OPEN ") + "the door, but it is still " + (isClosed ? "CLOSED":"OPEN"));
      			this.currentDoorState.setValue(DoorState.STOPPED);
      			this.targetDoorState.setValue(isClosed ? DoorState.CLOSED : DoorState.OPEN);
    		} else {
      			this.currentDoorState.setValue(this.targetState);
    		}
    		this.operating = false;
  	},

  	getTargetState: function(callback) {
    		callback(null, this.targetState);
  	},

	getServices = function() {
  		return [this.service];
	},

};
