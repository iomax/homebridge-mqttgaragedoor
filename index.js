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
	this.topicOpenGet	= ( config["topics"].openGet !== undefined ) ? config["topics"].openGet : "";
	this.topicClosedGet	= ( config["topics"].closedGet !== undefined ) ? config["topics"].closedGet : "";
	this.topicStatusSet	= config["topics"].statusSet;
	this.OpenValue		= ( config["topics"].openValue !== undefined ) ? config["topics"].openValue : "true";
	this.ClosedValue	= ( config["topics"].closedValue !== undefined ) ? config["topics"].closedValue : "true";

	this.doorRunInSeconds = config["doorRunInSeconds"]; 
	this.pauseInSeconds = config["pauseInSeconds"]; 

	this.garageDoorOpener = new Service.GarageDoorOpener(this.name);

//	this.currentDoorState = this.garageDoorOpener.getCharacteristic(DoorState);
	this.currentDoorState = this.garageDoorOpener.getCharacteristic(Characteristic.CurrentDoorState);
    	this.currentDoorState.on('get', this.getState.bind(this));
	this.targetDoorState = this.garageDoorOpener.getCharacteristic(Characteristic.TargetDoorState);
    	this.targetDoorState.on('set', this.setState.bind(this));
    	this.targetDoorState.on('get', this.getTargetState.bind(this));

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
		that.showLog("Getting state");

                if  (topic == that.topicClosedGet ) {
                        if ( topicGotStatus ) {
                               	that.targetDoorState.setValue(DoorState.CLOSED, undefined, 'fromGetValue');
                               	that.currentDoorState.setValue(DoorState.CLOSED)
				that.targetState = DoorState.CLOSED;
				if ( that.TimeOut !== undefined ) {
					clearTimeout( that.TimeOut )
					that.operating = false;
				};
			} else if ( ! that.operating) {
		                that.operating = true;
                              	that.targetDoorState.setValue(DoorState.OPEN, undefined, 'fromGetValue');
                               	that.currentDoorState.setValue(DoorState.OPENING );
				that.targetState = DoorState.OPEN;
				that.TimeOut = setTimeout(that.setFinalDoorState.bind(that), that.doorRunInSeconds * 1000);
			};
		} else if (topic == that.topicOpenGet ) {
                        if ( topicGotStatus ) {
                               	that.targetDoorState.setValue(DoorState.OPEN, undefined, 'fromGetValue');
                               	that.currentDoorState.setValue(DoorState.OPEN);
				that.targetState = DoorState.OPEN;
				if ( that.TimeOut !== undefined ) {
					clearTimeout( that.TimeOut )
					that.operating = false;
				};
			} else if ( ! that.operating ) {
		                that.operating = true;
                               	that.targetDoorState.setValue(DoorState.CLOSED, undefined, 'fromGetValue');
                               	that.currentDoorState.setValue(DoorState.CLOSING);
				that.targetState = DoorState.CLOSED;
				that.TimeOut = setTimeout(that.setFinalDoorState.bind(that), that.doorRunInSeconds * 1000);
                        }; 
		};
		that.showLog("Getting state END ");
	});
    	
	if( this.topicOpenGet !== "" ) {
		this.client.subscribe(this.topicOpenGet);
	}
	if( this.topicClosedGet !== "" ) {
		this.client.subscribe(this.topicClosedGet);
	}

	this.operating = false;
	this.Closed = true;
	this.Open = false;
    	this.currentDoorState.setValue( DoorState.CLOSED );
	this.targetState = DoorState.CLOSED
   	this.targetDoorState.setValue( DoorState.CLOSED );
}

module.exports = function(homebridge) {
  	Service = homebridge.hap.Service;
  	Characteristic = homebridge.hap.Characteristic;
	DoorState = homebridge.hap.Characteristic.CurrentDoorState;
  
  	homebridge.registerAccessory("homebridge-mqttgaragedoor", "mqttgaragedoor", MqttGarageDoorAccessory);
}

MqttGarageDoorAccessory.prototype = {

	showLog: function( msg, status ) {
		var ll = "";
                if ( msg !== undefined)  this.log( msg );
                if( status !== undefined) this.log("Status : " + (status == DoorState.OPEN ? "OPEN" : "CLOSED") );
		this.log(" isClosed : " + ( this.isClosed() ? "CLOSED" : "OPEN") );
		this.log(" isOpen : " + ( this.isOpen() ? "OPEN" : "CLOSED") );
	 	this.log(" targetState : " + ( this.targetState == DoorState.OPEN ? "OPEN" : "CLOSED") );
		this.log(" Operating : " + this.operating );
		if( status !== undefined) this.log(" statusChanged : " + this.statusChanged(status) );
	},

	getState: function(callback) {
    		var isClosed = this.isClosed();
    		this.log("GarageDoor is " + (isClosed ? "CLOSED ("+DoorState.CLOSED+")" : "OPEN ("+DoorState.OPEN+")")); 
    		callback(null, (isClosed ? DoorState.CLOSED : DoorState.OPEN));
	},

	autoClose : function() {
                this.operating = true;
              	this.targetDoorState.setValue(DoorState.CLOSED, undefined, 'fromGetValue');
               	this.currentDoorState.setValue(DoorState.CLOSING);
		this.targetState = DoorState.CLOSED;
		this.isClosed(true);
		this.TimeOut = setTimeout(this.setFinalDoorState.bind(this), this.doorRunInSeconds * 1000);
	},

	setState: function(status, callback, context) {
		if(context !== 'fromGetValue') {
		 	this.showLog("Setting state", status );
    			if ( this.statusChanged(status) ) { 
        			this.operating = true; 
				this.TimeOut = setTimeout(this.setFinalDoorState.bind(this), this.doorRunInSeconds * 1000);
	        		this.log("Triggering GarageDoor Command");
				this.client.publish(this.topicStatusSet, "on");
				this.targetState = status;
            			this.currentDoorState.setValue( (status == DoorState.OPEN ?  DoorState.OPENING : DoorState.CLOSING ) );
				if(status == DoorState.OPEN ) this.isOpen(true);
				else this.isClosed(true);
			}
		}
		callback();
	 	this.showLog("Setting state END", status );
	},

	isClosed: function(status) {
		if( status !== undefined ) {
			if( this.topicClosedGet == "" )  this.Closed = status;
                	if( this.topicOpenGet == "" ) this.Open = ! this.Closed;
		};
		if( this.topicClosedGet !== "" ) return( this.Closed )
		else return( !this.Open );
 	},

	isOpen: function(status) {
		if( status !== undefined ) {
                	if( this.topicOpenGet == "" ) this.Open = status;
			if( this.topicClosedGet == "" ) this.Closed = ! this.Open;
		};
		if( this.topicOpenGet !== "" ) return( this.Open )
		else return( !this.Closed );
 	},

	statusChanged: function( status ) {
    		if ((status == DoorState.OPEN && this.isClosed()) || (status == DoorState.CLOSED && this.isOpen() )) {
			return( true );
		} else return( false );
	},

	setFinalDoorState: function() {
	 	this.showLog("Setting Final", this.targetState);
		if( this.operating ) {
			if( this.targetState == DoorState.CLOSED ) {
				if ( this.isClosed() ) {
	                        	this.currentDoorState.setValue( DoorState.CLOSED);
					if (this.topicClosedGet !== "") this.isOpen(false);
				} else {
                                       	this.currentDoorState.setValue( DoorState.OPEN );
					this.targetState = DoorState.OPEN;
                                        this.targetDoorState.setValue( DoorState.OPEN, undefined, 'fromGetValue' );
				};
			} else if( this.targetState == DoorState.OPEN ) {
                        	if ( this.isOpen() ) {
                               		this.currentDoorState.setValue( DoorState.OPEN);
                                	if (this.topicOpenGet !== "") this.isOpen(true);
					if ( this.pauseInSeconds !== undefined ) {
						this.TimeOut = setTimeout(this.autoClose.bind(this), this.pauseInSeconds * 1000);
					};
				} else {
                                        this.currentDoorState.setValue( DoorState.CLOSED );
					this.targetState = DoorState.CLOSE;
                                        this.targetDoorState.setValue( DoorState.CLOSED, undefined, 'fromGetValue' );
				};
    			}
    			this.operating = false;
		}
	 	this.showLog("Setting Final END", this.targetState);
  	},

  	getTargetState: function(callback) {
    		callback(null, this.targetState);
  	},

	getServices:  function() {
		return [this.infoService, this.garageDoorOpener];
	},



};

