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
// 			  },
//                        "doorPollInMs": 4000,
//                        "doorRunInSeconds": 20,
//                        "doorFeedBack" : "PUT TYPE OF DOOR FEEDBACK [ OPEN | CLOSED | BOTH | NONE ]"
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

	this.doorPollInMs = config["doorPollInMs"];
	this.doorRunInSeconds = config["doorRunInSeconds"]; 
	this.doorFeedBack = config["doorFeedBack"]; 

	this.switchStatus = false;
	
	this.garageDoorOpener = new Service.GarageDoorOpener(this.name);

	this.currentDoorState = this.garageDoorOpener.getCharacteristic(DoorState);
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
           .setCharacteristic(Characteristic.SerialNumber, "Version 1.0.0");
  

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
			var isClosed = that.isClosed();
			that.log("Getting state " + (isClosed ?  "CLOSED" : "OPEN") +" - it was " + (that.wasClosed ? "CLOSED" : "OPEN") );
    			if ( (that.wasClosed && !isClosed) || (!that.wasClosed && isClosed) ) {
				var state = isClosed ? DoorState.CLOSED : DoorState.OPEN;
	                       	that.operating = true;
                               	that.currentDoorState.setValue( (isClosed ? DoorState.CLOSING : DoorState.OPENING ), undefined, 'fromGetValue');
                        	that.targetDoorState.setValue(state);
                        	that.targetState = state;
				that.setFeedbackTimeout('fromGetValue');
			}
			that.monitorDoorState();
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
		if(context !== 'fromGetValue') {
    			this.targetState = status;
	    		var isClosed = this.isClosed() ;
    			this.log("Setting state to " + (status == DoorState.OPEN ? "OPEN" : "CLOSED") +" - it was " + (isClosed ? "CLOSED" : "OPEN") );
    			if ((status == DoorState.OPEN && isClosed) || (status == DoorState.CLOSED && !isClosed)) {
        			this.operating = true; 
        			if (status == DoorState.OPEN) {
            				this.currentDoorState.setValue(DoorState.OPENING);
        			} else {
            				this.currentDoorState.setValue(DoorState.CLOSING);
        			}
				this.setFeedbackTimeout();
	        		this.log("Triggering GarageDoor Command");
				this.client.publish(this.topicStatusSet, "push");
//				setTimeout(this.pushOff.bind(this), 500);
			}
		}
		callback();
	},

	isClosed: function() {
		return(!this.switchStatus);
 	},

	pushOff: function() {
 		this.client.publish(this.topicStatusSet, "false");
	},

	setFeedbackTimeout: function(context ) {
		switch( this.doorFeedBack) {
		case 'CLOSED':
			if ( this.targetState == DoorState.CLOSED ) {
				setTimeout(this.setFinalDoorState.bind(this), ( context == 'fromGetValue' ? 1 : this.doorRunInSeconds ) * 1000 );
			} else {
				setTimeout(this.setFinalDoorState.bind(this), this.doorRunInSeconds * 1000 );
			};
			break;
		case 'OPEN': 
			if ( this.targetState == DoorState.OPEN ) {
				setTimeout(this.setFinalDoorState.bind(this), ( context == 'fromGetValue' ? 1 : this.doorRunInSeconds ) * 1000 );	
			} else {
				setTimeout(this.setFinalDoorState.bind(this), this.doorRunInSeconds * 1000);
			};
			break;
		case 'BOTH': 
			setTimeout(this.setFinalDoorState.bind(this), ( context == 'fromGetValue' ? 1 : this.doorRunInSeconds ) * 1000 );	
			break;
		default: 
			setTimeout(this.setFinalDoorState.bind(this), this.doorRunInSeconds * 1000);
		}
	},
			
	setFinalDoorState: function() {
		if( this.operating ) {
    			var isClosed = this.isClosed();
    			if ((this.targetState == DoorState.CLOSED && !isClosed) || (this.targetState == DoorState.OPEN && isClosed)) {
      				this.log("Was trying to " + (this.targetState == DoorState.CLOSED ? " CLOSE " : " OPEN ") + "the door, but it is still " + (isClosed ? "CLOSED":"OPEN"));
//	      			this.currentDoorState.setValue(DoorState.STOPPED);
      				this.currentDoorState.setValue(isClosed ? DoorState.CLOSED : DoorState.OPEN);
      				this.targetDoorState.setValue(isClosed ? DoorState.CLOSED : DoorState.OPEN);
    			} else {
      				this.currentDoorState.setValue(this.targetState);
    			}
		}
    		this.operating = false;
  	},

  	getTargetState: function(callback) {
    		callback(null, this.targetState);
  	},

	getServices:  function() {
		return [this.infoService, this.garageDoorOpener];
	},

};
