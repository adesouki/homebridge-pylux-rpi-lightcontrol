import { Service, PlatformAccessory, PlatformConfig } from 'homebridge';

import { PyluxRPILightSWPlatform } from './platform';
import fetch from 'node-fetch';
/* eslint-disable */
const pollingtoevent = require('polling-to-event');

export class PyluxRPILightSW {
  private service: Service;
  private token: string;
  private ip: string;
  private name: string;
  private roomName: string;
  private subType: string;
  private port: number;
  private polling_interval: number;
  private switchSerialNumber: string;
  private url: string;

  private states = {
    On: false,
  };

  constructor(
    private readonly platform: PyluxRPILightSWPlatform,
    private readonly accessory: PlatformAccessory,
    lightSwitchConfig: PlatformConfig,
  ) {
    this.ip = lightSwitchConfig.ip as string;
    this.port = lightSwitchConfig.port as number;
	this.name = lightSwitchConfig.name as string;
	this.roomName = lightSwitchConfig.roomName as string;
	this.subType = lightSwitchConfig.subType as string;
    this.switchSerialNumber = lightSwitchConfig.serial as string;
    this.token = lightSwitchConfig.rpi_token as string;
    this.url = 'http://' + this.ip + ':' + this.port + '/light';
    this.polling_interval = lightSwitchConfig.polling_interval as number;
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(
        this.platform.Characteristic.Manufacturer,
        'Pylux Solutions, LLC.',
      )
      .setCharacteristic(
        this.platform.Characteristic.Model,
        'Pylux Smart Light Switch',
      )
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        this.switchSerialNumber,
      ).setCharacteristic(
        this.platform.Characteristic.Name,
		this.name
      );

    this.service =
      this.accessory.getService(this.platform.Service.Lightbulb) ||
      this.accessory.addService(this.platform.Service.Lightbulb, this.roomName + this.name, this.subType);

    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      accessory.context.device.name,
    );

    this.service
      .getCharacteristic(this.platform.Characteristic.On)
      .onGet(this.handleOnGet.bind(this))
      .onSet(this.handleOnSet.bind(this));

    this.switchStatusPolling();
  }

  switchStatusPolling() {
    pollingtoevent(
      () => {
        this.getStatus(false);
      },
      {
        longpolling: true,
        interval: this.polling_interval,
        longpollEventName: 'statuspoll',
      },
    );
  }

  getStatus(exp: boolean) {
    try {
      fetch(this.url, {
        method: 'POST',
        body: JSON.stringify({ req: 'check-status', token: this.token }),
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/plain, */*',
        },
      })
        .then((res) => res.json())
        .then((res) => {
          if (res.token === this.token) {
            if (res.status === 'on') {
              this.states.On = true;
            } else if (res.status === 'off') {
              this.states.On = false;
            }
			if(!exp)
				this.service.getCharacteristic(this.platform.Characteristic.On).updateValue(this.states.On);
          }
        })
        .catch((error) => {
          this.platform.log.info('ERROR:', error);          		  
        });
    } catch (error) {
      this.platform.log.info('ERROR:', error);
    }
  }

  handleOnSet(value) {
    let fRequestString: string;
    // 👇️ const response: Response
    if (value) {
      //ON
      fRequestString = 'turn-on';
    } else {
      //OFF
      fRequestString = 'turn-off';
    }
    try {
      fetch(this.url, {
        method: 'POST',
        body: JSON.stringify({ req: fRequestString, token: this.token }),
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/plain, */*',
        },
      })
        .then((res) => res.json())
        .then((res) => {
          if (res.token === this.token) {
            this.states.On = res.status === 'on' ? true : false;
          }
        })
        .catch((error) => {
          this.platform.log.info('ERROR:', error);
        });
    } catch (error) {
      this.platform.log.info('ERROR:', error);
    }
	
    this.service.updateCharacteristic(
      this.platform.Characteristic.On,
      this.states.On,
    );
  }

  handleOnGet() {
    this.getStatus(true);
    return this.states.On;
  }
}
