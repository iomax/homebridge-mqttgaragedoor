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
//              "doorRunInSeconds": "OPEN/CLOSE RUN TIME IN SECONDS (DEFAULT 20"),
//		"pauseInSeconds" : "IF DEFINED : AUTO CLOSE AFTER [Seconds]" 
//     }
// ],
//
// When you attempt to add a device, it will ask for a "PIN code".
// The default code for all HomeBridge accessories is 031-45-154.

'use strict';

var Service, Characteristic, DoorState;
var mqtt = require('mqtt');


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
    		reconnectPeriod: 2000,
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
	this.closeStatusCmdTopic= config["topics"].closeStatusCmdTopic;
	this.closeStatusCmd	= ( config["topics"].closeStatusCmd !== undefined ) ? config["topics"].closeStatusCmd : "";

        this.doubleSwitch = ( this.topicOpenGet !== undefined && this.topicClosedGet !== undefined );

	this.doorRunInSeconds 	= (config["doorRunInSeconds"] !== undefined ? config["doorRunInSeconds"] : 20 ); 
	if(! this.doubleSwitch ) this.pauseInSeconds 	= config["pauseInSeconds"]; 
	this.topicverbose	= config["topics"].showlog;

	this.Running = false;
	this.Closed = true;
	this.Open = !this.Closed;
	this.DoorStateChanged = false;
	var that = this;

	this.garageDoorOpener = new Service.GarageDoorOpener(this.name);

	this.currentDoorState = this.garageDoorOpener.getCharacteristic(Characteristic.CurrentDoorState);
    	this.currentDoorState.on('get', this.getState.bind(this));
	this.targetDoorState = this.garageDoorOpener.getCharacteristic(Characteristic.TargetDoorState);
    	this.targetDoorState.on('set', this.setTargetState.bind(this));
	this.ObstructionDetected = this.garageDoorOpener.getCharacteristic(Characteristic.ObstructionDetected);

    	this.infoService = new Service.AccessoryInformation();
    	this.infoService
      	   .setCharacteristic(Characteristic.Manufacturer, "Opensource Community")
           .setCharacteristic(Characteristic.Model, "MQTT GarageDoor")
           .setCharacteristic(Characteristic.SerialNumber, "Version 1.0.2");
  

	// connect to MQTT broker
	this.client = mqtt.connect(this.url, this.options);
	this.client.on('error', function () {
		that.log('Error event on MQTT');
	});


	// Fixed issue where after disconnections topics would no resubscripted
	// based on idea by [MrBalonio] (https://github.com/mrbalonio)
	this.client.on('connect', function () {
		that.log('Subscribing to topics');
 		if( that.topicOpenGet !== undefined ) {
 			that.client.subscribe(that.topicOpenGet);
 		};
 		if( that.topicClosedGet !== undefined ) {
 			that.client.subscribe(that.topicClosedGet);
 		}
	});

	this.client.on('message', function (topic, message) {
		var status = message.toString();
		
		if (topic == that.topicClosedGet) {
			var topicGotStatus = (status == that.ClosedValue);
			that.isClosed( topicGotStatus);
			if( topicGotStatus ) var NewDoorState = DoorState.CLOSED
                        else var NewTarget = DoorState.OPEN;
		} else {
			var topicGotStatus = (status == that.OpenValue);
			that.isOpen( topicGotStatus);
			if(topicGotStatus) var NewDoorState = DoorState.OPEN
			else var NewTarget = DoorState.CLOSED;
		};

	        that.showLog("Getting state " +that.doorStateReadable(NewDoorState) + " its was " + that.doorStateReadable(that.currentDoorState.value) + " [TOPIC : " + topic + " ]");
		if ( topicGotStatus ) {
			that.setObstructionState( false );
        		that.currentDoorState.setValue(NewDoorState);
	               	that.targetDoorState.setValue(NewDoorState);
			that.Running = false;
			clearTimeout( that.TimeOut );
			if ( (that.pauseInSeconds !== undefined) && that.isOpen() ) {
				that.TimeOut = setTimeout(that.autoClose.bind(that), that.pauseInSeconds * 1000);
			};
		} else if (!that.Running && that.DoorStateChanged ) { 
                       	that.targetDoorState.setValue( NewTarget, undefined, "fromGetValue");
		};
		that.showLog("Final Getting State is " + that.doorStateReadable(that.currentDoorState.value) );
	});
    	
    	this.currentDoorState.setValue( DoorState.CLOSED );
   	this.targetDoorState.setValue( DoorState.CLOSED );
        this.getState();
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
	     if( this.topicverbose !== undefined ) {
                if ( msg !== undefined)  this.log( msg );
                if( status !== undefined) this.log("Status : " + this.doorStateReadable(status));
		this.log(" isClosed : " + this.isClosed() + " / " + this.Closed );
		this.log(" isOpen : " + this.isOpen() + " / " + this.Open );
		this.log(" currentState (HK) : " + this.doorStateReadable(this.currentDoorState.value) ); 
	 	this.log(" targetState (HK) : " + this.doorStateReadable(this.targetDoorState.value) );
		this.log(" Running : " + this.Running );
		this.log("----"  );
            }
	},


	autoClose : function() {
              	this.targetDoorState.setValue(DoorState.CLOSED, undefined, 'fromGetValue');
	},

	setTargetState: function(status, callback, context) {
	 	this.showLog("Setting Target :", status);
		if ( context !== 'noprocessing' ){ 
		if( status != this.currentDoorState.value ) {
			this.setObstructionState( false);
			clearTimeout( this.TimeOut );
        		this.Running = true; 
			this.TimeOut = setTimeout(this.setFinalDoorState.bind(this), this.doorRunInSeconds * 1000);
			if ( context !== 'fromGetValue'){
		        	this.log("Triggering GarageDoor Command");
				this.client.publish(this.topicStatusSet, "on");
			};
            		this.currentDoorState.setValue( (status == DoorState.OPEN ?  DoorState.OPENING : DoorState.CLOSING ) );
		};
	 	this.showLog("Setting Target END:");
		};

		if(callback !== undefined) callback();
	},

	isClosed: function(status) {
		if( status !== undefined ) { 
			if( this.Closed !== status  ) {
				this.DoorStateChanged = true;
				this.Closed = status;
                		if( this.topicOpenGet == undefined ) this.Open = ! this.Closed;
			} else this.DoorStateChanged = false;
		};
		return(this.Closed);
 	},

	isOpen: function(status) {
		if( status !== undefined ) {
			if( this.Open !== status ) {
				this.DoorStateChanged = true;
				this.Open = status;
				if( this.topicClosedGet == undefined ) this.Closed = ! this.Open;
			} else this.DoorStateChanged = false;
		};
		return(this.Open);
 	},

	setFinalDoorState: function() {
	 	this.showLog("Setting Final", this.targetDoorState.value);

		this.Running = false;
		delete this.TimeOut;

		switch(this.targetDoorState.value) {
			case DoorState.OPEN:
				if(this.topicOpenGet == undefined) this.isOpen(true);
				break;
			case DoorState.CLOSED:
				if(this.topicClosedGet == undefined) this.isClosed(true);
				break;
		};
		if( ! this.getObstructionState() ){
			if (((this.targetDoorState.value == DoorState.OPEN) && this.isOpen()) !== ((this.targetDoorState.value == DoorState.CLOSED) && this.isClosed()) ) {
				this.currentDoorState.setValue( ( this.isClosed() ? DoorState.CLOSED : DoorState.OPEN) );
				if ( (this.pauseInSeconds !== undefined) && this.isOpen() ) this.TimeOut = setTimeout(this.autoClose.bind(this), this.pauseInSeconds * 1000);
			} else {
				this.setObstructionState( true );
			};
		};
	 	this.showLog("Setting Final END" );
  	},

	getState: function( callback ) {
		if( this.openStatusCmdTopic !== undefined ) this.client.publish(this.openStatusCmdTopic, this.openStatusCmd); 
		if( this.closeStatusCmdTopic !== undefined ) this.client.publish(this.closeStatusCmdTopic, this.closeStatusCmd);
    		this.log("Garage Door is " + this.doorStateReadable(this.currentDoorState.value) );
		if(callback !== undefined) callback();
	},

        getObstructionState: function() {
		var isC = this.isClosed();
	        var isO = this.isOpen();
		var obs =  ( ( ( !this.Running ) && (isO == isC ) ) || ( isC && isO ) ) ;
		this.setObstructionState( obs);
		return(obs);
	}, 
			
	setObstructionState: function( state ) {
		this.showLog("Set Obstruction " + state );
		if ( state )  {
                   this.currentDoorState.setValue( DoorState.STOPPED );
                   this.ObstructionDetected.setValue( true );
                   if( !this.isClosed() ) this.targetDoorState.setValue( DoorState.OPEN, undefined, 'noprocessing')
		   else this.targetDoorState.setValue( 1 - this.targetDoorState.value, undefined, 'noprocessing');
		} else {
                   this.ObstructionDetected.setValue( false );
		};
	},	

	getServices:  function() {
		return [this.infoService, this.garageDoorOpener];
	},
};
