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
	this.topicStatusOpen	= ( config["topics"].statusOpen !== undefined ) ? config["topics"].statusOpen : "";
	this.topicStatusClose	= ( config["topics"].statusClose !== undefined ) ? config["topics"].statusClose : "";
	this.topicStatusSet	= config["topics"].statusSet;
	this.OpenValue		= ( config["topics"].OpenValue !== undefined ) ? config["topics"].OpenValue : "false";
	this.ClosedValue	= ( config["topics"].ClosedValue !== undefined ) ? config["topics"].ClosedValue : "false";

	this.doorRunInSeconds = config["doorRunInSeconds"]; 

	this.garageDoorOpener = new Service.GarageDoorOpener(this.name);

	this.currentDoorState = this.garageDoorOpener.getCharacteristic(DoorState);
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
		if (topic == that.topicStatusClose) {
			var topicGotStatus = (status == that.ClosedValue);
			that.Closed = topicGotStatus;
		} else {
			var topicGotStatus = (status == that.OpenValue);
			that.Open = topicGotStatus;
		};
		that.log("Getting state " + (that.isClosed() ?  "CLOSED" : "OPEN") +" - it was " + (that.wasClosed ? "CLOSED" : "OPEN") );
                if  (topic == that.topicStatusClose ) {
                        if ( topicGotStatus ) {
                               	that.targetDoorState.setValue(DoorState.CLOSED, undefined, 'fromGetValue');
                               	that.currentDoorState.setValue(DoorState.CLOSED)
				that.targetState = DoorState.CLOSED;
				if ( that.TimeOut !== undefined ) {
					clearTimeout( that.TimeOut )
					that.operating = false;
//					setTimeout(that.setFinalDoorState.bind(that), 50);
				};
			} else if ( ! that.operating) {
		                that.operating = true;
                              	that.targetDoorState.setValue(DoorState.OPEN, undefined, 'fromGetValue');
                               	that.currentDoorState.setValue(DoorState.OPENING );
				that.targetState = DoorState.OPEN;
				that.TimeOut = setTimeout(that.setFinalDoorState.bind(that), that.doorRunInSeconds * 1000);
			};
			that.wasClosed = that.isClosed() ;
		} else if (topic == that.topicStatusOpen ) {
                        if ( topicGotStatus ) {
                               	that.targetDoorState.setValue(DoorState.OPEN, undefined, 'fromGetValue');
                               	that.currentDoorState.setValue(DoorState.OPENING);
				that.targetState = DoorState.OPEN;
				if ( that.TimeOut !== undefined ) {
					clearTimeout( that.TimeOut )
					that.operating = false;
//					setTimeout(that.setFinalDoorState.bind(that), 50);
				};
			} else if ( ! that.operating ) {
		                that.operating = true;
                               	that.targetDoorState.setValue(DoorState.CLOSED, undefined, 'fromGetValue');
                               	that.currentDoorState.setValue(DoorState.CLOSING);
				that.targetState = DoorState.CLOSED;
				that.TimeOut = setTimeout(that.setFinalDoorState.bind(that), that.doorRunInSeconds * 1000);
                        }; 
			that.wasOpen = that.isOpen() ;
		};
	});
    	
	if( this.topicStatusOpen !== "" ) {
		this.client.subscribe(this.topicStatusOpen);
	}
	if( this.topicStatusClose !== "" ) {
		this.client.subscribe(this.topicStatusClose);
	}

	this.Closed = true;
	this.Open = false;
    	this.wasClosed = this.isClosed();
    	this.wasOpen = this.isOpen();
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

	getState: function(callback) {
    		var isClosed = this.isClosed();
    		this.log("GarageDoor is " + (isClosed ? "CLOSED ("+DoorState.CLOSED+")" : "OPEN ("+DoorState.OPEN+")")); 
    		callback(null, (isClosed ? DoorState.CLOSED : DoorState.OPEN));
	},

	setState: function(status, callback, context) {
		if(context !== 'fromGetValue') {
    			this.log("Setting state to " + (status == DoorState.OPEN ? "OPEN" : "CLOSED") +" - Closed  was " + ( this.isClosed() ? "CLOSED" : "OPEN") );
    			this.log("Setting state to " + (status == DoorState.OPEN ? "OPEN" : "CLOSED") +" - Open was " + ( this.isOpen() ? "OPEN" : "CLOSED") );
    			this.log("Status " + status + " - isClosed() " + this.isClosed() + " Status Changed : " + this.statusChanged(status) );
    			this.log("Status " + status + " - isOpen() " + this.isOpen() + " Status Changed : " + this.statusChanged(status) );
    			if ( this.statusChanged(status) ) { 
        			this.operating = true; 
//				this.targetDoorState.setValue(status);
				this.TimeOut = setTimeout(this.setFinalDoorState.bind(this), this.doorRunInSeconds * 1000);
	        		this.log("Triggering GarageDoor Command");
				this.client.publish(this.topicStatusSet, "on");
            			this.currentDoorState.setValue( (status == DoorState.OPEN ?  DoorState.OPENING : DoorState.CLOSING ) );
			}
		}
		callback();
	},

	isClosed: function(status) {
		if( this.topicStatusClose == "" && status !== undefined )  this.Closed = status;
		return( this.Closed );
 	},

	isOpen: function(status) {
                if( this.topicStatusOpen == "" && status !== undefined ) this.Open = status;
		return( this.Open );
 	},

	statusChanged: function( status ) {
    		if ((status == DoorState.OPEN && this.isClosed()) || (status == DoorState.CLOSED && this.isOpen() )) {
			return( true );
		} else return( false );
	},

	setFinalDoorState: function() {
	 	this.log("Setting Final state to " + ( this.targetState == DoorState.OPEN ? "OPEN" : "CLOSED") +" - it was operating " + this.operating );
		if( this.operating ) {
			if( this.targetState == DoorState.CLOSED ) {
				if (this.topicStatusClose !== "") {
					if ( this.isClosed() ) {
						this.isOpen(false);
		                        	this.currentDoorState.setValue( DoorState.CLOSED);
                                        	this.targetDoorState.setValue( DoorState.CLOSED );
					} else {
                                        	this.currentDoorState.setValue( DoorState.STOPPED );
                                        	this.targetDoorState.setValue( DoorState.STOPPED );
                                	}
				} else {
					this.isClosed(true);
					this.isOpen(false);
	                        	this.currentDoorState.setValue( DoorState.CLOSED);
                                       	this.targetDoorState.setValue( DoorState.CLOSED );
				}
			} else if( this.targetState == DoorState.OPEN ) {
                                if (this.topicStatusOpen !== "") {
                                        if ( this.isOpen() ) {
                                                this.isClose(false);
                                                this.currentDoorState.setValue( DoorState.OPEN);
                                                this.targetDoorState.setValue( DoorState.OPEN );
                                        } else {
                                                this.currentDoorState.setValue( DoorState.STOPPED );
                                                this.targetDoorState.setValue( DoorState.STOPPED );
                                        }
                                } else {
					this.isClosed(false);
					this.isOpen(true);
                                        this.currentDoorState.setValue( DoorState.OPEN);
                                        this.targetDoorState.setValue( DoorState.OPEN );
                                }
    			}
    			this.operating = false;
		}
  	},

  	getTargetState: function(callback) {
    		callback(null, this.targetState);
  	},

	getServices:  function() {
		return [this.infoService, this.garageDoorOpener];
	},

};

