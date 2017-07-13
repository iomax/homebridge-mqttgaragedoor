// MQTT GarageDoor Accessory plugin for HomeBridge
//
// Remember to add accessory to config.json. Example:
// "accessories": [
//     {
//            	"accessory": "mqttgaragedoor",
//            	"name": "NAME OF THE SWITCH",
//            	"url": "URL OF THE BROKER",
//  	      	"username": "USERNAME OF THE BROKER",
//		"password": "PASSWORD OF THE BROKER"
// 		"caption": "LABEL OF THE SWITCH",
// 		"topics": {
// 				"statusSet": 	"MQTT TOPIC FOR THE SETTING THE STATUS"
// 				"openGet": 	"OPTIONAL MQTT TOPIC FOR THE GETTING THE STATUS OF OPEN SWITCH",
// 				"closedGet": 	"OPTIONAL MQTT TOPIC FOR THE GETTING THE STATUS OF CLOSED SWITCH",
//				"openStatusCmdTopic": "OPTIONAL MQTT TOPIC TO ASK OPEN STATUS",
//				"openStatusCmd": "OPTIONAL THE STATUS COMMAND ( DEFAULT "")",
//				"closeStatusCmdTopic": "OPTIONAL MQTT TOPIC TO ASK CLOSE STATUS",
//				"closeStatusCmd": "OPTIONAL THE STATUS COMMAND (DEFAULT "")",
// 				"openValue": 	"OPTIONAL VALUE THAT MEANS OPEN (DEFAULT true)"
// 				"closedValue": 	"OPTIONAL VALUE THAT MEANS CLOSED (DEFAULT true)"
// 			},
//              "doorRunInSeconds": "OPEN/CLOSE RUN TIME IN SECONDS",
//		"pauseInSeconds" : "IF DEFINED : AUTO CLOSE AFTER [Seconds]" 
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
  	this.name 		= config["name"];
  	this.url 		= config["url"];
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
	this.topicOpenGet	= config["topics"].openGet;
	this.topicClosedGet	= config["topics"].closedGet;
	this.topicStatusSet	= config["topics"].statusSet;
	this.OpenValue		= ( config["topics"].openValue !== undefined ) ? config["topics"].openValue : "true";
	this.ClosedValue	= ( config["topics"].closedValue !== undefined ) ? config["topics"].closedValue : "true";
	this.openStatusCmdTopic	= config["topics"].openStatusCmdTopic; 
	this.openStatusCmd	= ( config["topics"].openStatusCmd !== undefined ) ? config["topics"].openStatusCmd : "";
	this.closeStatusCmdTopic	= config["topics"].closeStatusCmdTopic;
	this.closeStatusCmd	= ( config["topics"].closeStatusCmd !== undefined ) ? config["topics"].closeStatusCmd : "";

	this.doorRunInSeconds = config["doorRunInSeconds"]; 
	this.pauseInSeconds = config["pauseInSeconds"]; 

	this.Running = false;
	this.Closed = true;
	this.Open = !this.Closed;

	this.garageDoorOpener = new Service.GarageDoorOpener(this.name);

	this.currentDoorState = this.garageDoorOpener.getCharacteristic(Characteristic.CurrentDoorState);
    	this.currentDoorState.on('get', this.getState.bind(this));
	this.targetDoorState = this.garageDoorOpener.getCharacteristic(Characteristic.TargetDoorState);
    	this.targetDoorState.on('set', this.setTargetState.bind(this));


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
		var status = message.toString();
		
		if (topic == that.topicClosedGet) {
			var topicGotStatus = (status == that.ClosedValue);
			that.Closed = topicGotStatus;
		} else {
			var topicGotStatus = (status == that.OpenValue);
			that.Open = topicGotStatus;
		};
		var NewDoorState = ( ( (topic == that.topicClosedGet) == topicGotStatus ) ? DoorState.CLOSED : DoorState.OPEN );
		var NewDoorStateRun = ( ( (topic == that.topicClosedGet) == topicGotStatus ) ? DoorState.CLOSING : DoorState.OPENING );

		that.showLog("Getting state");
		that.log("Getting state " +that.doorStateReadable(NewDoorState));

		if ( NewDoorState !== that.currentDoorState.value) {
                	if ( topicGotStatus ) {
        	       		that.currentDoorState.setValue(NewDoorState)
	               		that.targetDoorState.setValue(NewDoorState);
				if ( that.TimeOut !== undefined ) {
					clearTimeout( that.TimeOut );
					that.Running = false;
				};
			} else if ( ! that.Running) {
				if ( that.TimeOut !== undefined ) clearTimeout( that.TimeOut );
        			that.Running = true; 
                                that.targetDoorState.setValue( NewDoorState, undefined, 'fromGetValue' );
            			that.currentDoorState.setValue( NewDoorStateRun );
				that.TimeOut = setTimeout(that.setFinalDoorState.bind(that), that.doorRunInSeconds * 1000);
			};
		}
		that.showLog("Getting state END ");
	});
    	
	if( this.topicOpenGet !== undefined ) {
		this.client.subscribe(this.topicOpenGet);
	}
	if( this.topicClosedGet !== undefined ) {
		this.client.subscribe(this.topicClosedGet);
	}

    	this.currentDoorState.setValue( DoorState.CLOSED );
   	this.targetDoorState.setValue( DoorState.CLOSED );
}

module.exports = function(homebridge) {
  	Service = homebridge.hap.Service;
  	Characteristic = homebridge.hap.Characteristic;
	DoorState = homebridge.hap.Characteristic.CurrentDoorState;
  
  	homebridge.registerAccessory("homebridge-mqttgaragedoor", "mqttgaragedoor", MqttGarageDoorAccessory);
}

MqttGarageDoorAccessory.prototype = {
	
	doorStateReadable : function( doorState ) {
		switch (doorState) {
		case DoorState.OPEN:
			return "OPEN";
		case DoorState.OPENING:
			return "OPENING";
		case DoorState.CLOSING:
			return "CLOSING";
		case DoorState.CLOSED:
			return "CLOSED";
		case DoorState.STOPPED:
			return "STOPPED";
		}
	},

	showLog: function( msg, status ) {
		return;
                if ( msg !== undefined)  this.log( msg );
                if( status !== undefined) this.log("Status : " + this.doorStateReadable(status));
		this.log(" isClosed : " + this.isClosed() + " / " + this.Closed );
		this.log(" isOpen : " + this.isOpen() + " / " + this.Open );
		this.log(" currentState (HK) : " + this.doorStateReadable(this.currentDoorState.value) ); 
	 	this.log(" targetState (HK) : " + this.doorStateReadable(this.targetDoorState.value) );
		this.log(" Running : " + this.Running );
	},


	autoClose : function() {
                this.Running = true;
              	this.targetDoorState.setValue(DoorState.CLOSED, undefined, 'fromGetValue');
               	this.currentDoorState.setValue(DoorState.CLOSING);
		this.isClosed(true);
		this.TimeOut = setTimeout(this.setFinalDoorState.bind(this), this.doorRunInSeconds * 1000);
	},

	setTargetState: function(status, callback, context) {
	 	this.showLog("Setting Target :", status);
		this.isOpen( ( status == DoorState.OPEN ? true : false) );
		this.isClosed( (status == DoorState.CLOSED ? true : false ) );
		if(context !== 'fromGetValue') {
			if( status != this.currentDoorState.value ) {
                        	if ( this.Running ) clearTimeout( this.TimeOut );
        			this.Running = true; 
				this.TimeOut = setTimeout(this.setFinalDoorState.bind(this), this.doorRunInSeconds * 1000);
	        		this.log("Triggering GarageDoor Command");
				this.client.publish(this.topicStatusSet, "on");
            			this.currentDoorState.setValue( (status == DoorState.OPEN ?  DoorState.OPENING : DoorState.CLOSING ) );
			}
		};
	 	this.showLog("Setting Target END:", status);
		callback();
	},

	isClosed: function(status) {
		if( status !== undefined ) {
			if( this.topicClosedGet == undefined ) {
 				this.Closed = status;
                		if( this.topicOpenGet == undefined ) this.Open = ! this.Closed;
			};
		};
		if( this.topicClosedGet !== undefined ) return( this.Closed )
		else return( !this.Open );
 	},

	isOpen: function(status) {
		if( status !== undefined ) {
                	if( this.topicOpenGet == undefined ) {
				this.Open = status;
				if( this.topicClosedGet == undefined ) this.Closed = ! this.Open;
			};
		};
		if( this.topicOpenGet !== undefined ) return( this.Open )
		else return( !this.Closed );
 	},

	setFinalDoorState: function() {
	 	this.showLog("Setting Final", this.targetDoorState.value);
		if( this.Running ) {
			if( this.targetDoorState.value == DoorState.CLOSED ) {
				if ( this.isClosed() ) {
	                        	this.currentDoorState.setValue( DoorState.CLOSED);
				} else {
                                      	this.currentDoorState.setValue( DoorState.OPEN );
                                        this.targetDoorState.setValue( DoorState.OPEN, undefined, 'fromGetValue' );
				};
			} else if( this.targetDoorState.value == DoorState.OPEN ) {
                        	if ( this.isOpen() ) {
                               		this.currentDoorState.setValue( DoorState.OPEN);
					if ( this.pauseInSeconds !== undefined ) {
						this.TimeOut = setTimeout(this.autoClose.bind(this), this.pauseInSeconds * 1000);
					};
				} else {
                                        this.currentDoorState.setValue( DoorState.CLOSED );
                                        this.targetDoorState.setValue( DoorState.CLOSED, undefined, 'fromGetValue' );
				};
    			}
    			this.Running = false;
		}
	 	this.showLog("Setting Final END", this.targetDoorState.value);
    		this.log("Final State is " + this.doorStateReadable(this.currentDoorState.value) );
  	},

	getState: function(callback) {
    		this.log("Garage Door is " + this.doorStateReadable(this.currentDoorState.value) );
		if( this.openStatusCmdTopic !== undefined ) this.client.publish(this.openStatusCmdiTopic, this.openStatusCmd); 
		if( this.closeStatusCmdTopic !== undefined ) this.client.publish(this.closeStatusCmdTopic, this.closeStatusCmd); 
    		callback(null, this.currentDoorState.value);
	},

	getServices:  function() {
		return [this.infoService, this.garageDoorOpener];
	},
};
