import {
	Device,
	SingleProperty,
	SinglePropertyStatus,
	StatusCode,
	ValueSingle,
} from "cocoro-sdk";
import {
	Service,
	PlatformAccessory,
	CharacteristicValue,
	Characteristic,
} from "homebridge";

import { SharpCocoroPlatform } from "./platform";

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class CocoroDevice {
	private service: Service;
	private device: Device;

	constructor(
		private readonly platform: SharpCocoroPlatform,
		private readonly accessory: PlatformAccessory
	) {
		this.device = accessory.context.device as Device;

		// set accessory information
		this.accessory
			.getService(this.platform.Service.AccessoryInformation)!
			.setCharacteristic(
				this.platform.Characteristic.Manufacturer,
				this.device.maker
			)
			.setCharacteristic(this.platform.Characteristic.Model, this.device.model)
			.setCharacteristic(
				this.platform.Characteristic.SerialNumber,
				this.device.serialNumber || this.device.echonetNode
			);

		// get the LightBulb service if it exists, otherwise create a new LightBulb service
		// you can create multiple services for each accessory
		this.service =
			this.accessory.getService(this.platform.Service.Thermostat) ||
			this.accessory.addService(this.platform.Service.Thermostat);

		// set the service name, this is what is displayed as the default name on the Home app
		// in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
		this.service.setCharacteristic(
			this.platform.Characteristic.Name,
			this.device.name
		);

		// const powerStatus = device.queryPropertyStatus(StatusCode.POWER)
		this.service
			.getCharacteristic(
				this.platform.Characteristic.CurrentHeatingCoolingState
			)
			.onGet(this.handleTargetHeatingCoolingStateGet.bind(this));

		this.service.setCharacteristic(
			this.platform.Characteristic.CurrentHeatingCoolingState,
			this.platform.Characteristic.CurrentHeatingCoolingState.COOL
		);

		this.service
			.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
			.onGet(this.handleCurrentTemperatureGet.bind(this));

		this.service
			.getCharacteristic(this.platform.Characteristic.TargetTemperature)
			.onGet(this.handleTargetTemperatureGet.bind(this))
			.onSet(this.handleTargetTemperatureSet.bind(this));


		this.service
			.getCharacteristic(this.platform.Characteristic.TargetHeatingCoolingState)
			.onGet(this.handleTargetHeatingCoolingStateGet.bind(this))
			.onSet(this.handleTargetHeatingCoolingStateSet.bind(this));

		const fanService =
			this.accessory.getService(this.platform.Service.Fanv2) ||
			this.accessory.addService(this.platform.Service.Fanv2);
		// this.service.addLinkedService(fanService);

		fanService
			.getCharacteristic(this.platform.Characteristic.RotationSpeed)
			.onGet(this.handleRotationSpeedGet.bind(this))
			.onSet(this.handleRotationSpeedSet.bind(this))
			.setProps({
				minStep: 10,
				minValue: 0,
				maxValue: 100,
			});

		fanService
			.getCharacteristic(this.platform.Characteristic.Active)
			.onGet(this.handleFanActiveGet.bind(this))
			.onSet(this.handleFanActiveSet.bind(this));

		fanService.setCharacteristic(
			this.platform.Characteristic.Name,
			this.device.name
		);

		setInterval(this.refreshData.bind(this), 10000);
	}

	async refreshData() {
		this.platform.log.debug(`refreshing device ${this.device.name}`);
		const d = await this.platform.fetchDevice(this.device);
		this.device = d;
	}

	handleRotationSpeedGet() {
		const ws = this.device.getWindspeed();
		switch (ws) {
			case ValueSingle.WINDSPEED_LEVEL_1:
				return 12;
			case ValueSingle.WINDSPEED_LEVEL_2:
				return 25;
			case ValueSingle.WINDSPEED_LEVEL_3:
				return 38;
			case ValueSingle.WINDSPEED_LEVEL_4:
				return 50;
			case ValueSingle.WINDSPEED_LEVEL_5:
				return 62;
			case ValueSingle.WINDSPEED_LEVEL_6:
				return 75;
			case ValueSingle.WINDSPEED_LEVEL_7:
				return 87;
			case ValueSingle.WINDSPEED_LEVEL_8:
				return 100;
			case ValueSingle.WINDSPEED_LEVEL_AUTO:
				return 0;
		}

		return 0;
	}

	async handleRotationSpeedSet(speed) {
		switch (true) {
			case speed === 100:
				this.device.queueWindspeedUpdate(ValueSingle.WINDSPEED_LEVEL_8);
				this.device.queueTemperatureUpdate(this.device.getTemperature());
				break;

			case speed >= 87:
				this.device.queueWindspeedUpdate(ValueSingle.WINDSPEED_LEVEL_7);
				this.device.queueTemperatureUpdate(this.device.getTemperature());
				break;

			case speed >= 75:
				this.device.queueWindspeedUpdate(ValueSingle.WINDSPEED_LEVEL_6);
				this.device.queueTemperatureUpdate(this.device.getTemperature());
				break;

			case speed >= 62:
				this.device.queueWindspeedUpdate(ValueSingle.WINDSPEED_LEVEL_5);
				this.device.queueTemperatureUpdate(this.device.getTemperature());
				break;

			case speed >= 50:
				this.device.queueWindspeedUpdate(ValueSingle.WINDSPEED_LEVEL_4);
				this.device.queueTemperatureUpdate(this.device.getTemperature());
				break;

			case speed >= 38:
				this.device.queueWindspeedUpdate(ValueSingle.WINDSPEED_LEVEL_3);
				this.device.queueTemperatureUpdate(this.device.getTemperature());
				break;

			case speed >= 25:
				this.device.queueWindspeedUpdate(ValueSingle.WINDSPEED_LEVEL_2);
				this.device.queueTemperatureUpdate(this.device.getTemperature());
				break;

			case speed <= 12:
				this.device.queueWindspeedUpdate(ValueSingle.WINDSPEED_LEVEL_1);
				this.device.queueTemperatureUpdate(this.device.getTemperature());
				break;
		}

		await this.platform.submitDeviceUpdates(this.device);
	}

	handleCurrentTemperatureGet() {
		return this.device.getRoomTemperature();
	}

	handleTargetTemperatureGet() {
		return this.device.getState8().temperature;
	}

	async handleTargetTemperatureSet(t) {
		this.platform.log.debug("setting new temp", t);

		// cocoro API requires these 3 to be batched together when changing temperature
		this.device.queueTemperatureUpdate(t);
		this.device.queuePowerOn();

		const status = this.device.getPropertyStatus(StatusCode.OPERATION_MODE);
		if (status) {
			this.device.queuePropertyStatusUpdate(status);
		}

		await this.platform.submitDeviceUpdates(this.device);
	}


	handleTargetHeatingCoolingStateGet() {
		const currentState = this.device.getPropertyStatus(
			StatusCode.OPERATION_MODE
		) as SinglePropertyStatus;

		const powerState = this.device.getPropertyStatus(
			StatusCode.POWER
		) as SinglePropertyStatus;

		if (powerState.valueSingle.code === ValueSingle.POWER_OFF) {
			return this.platform.Characteristic.TargetHeatingCoolingState.OFF;
		}

		switch (currentState.valueSingle.code) {
			case ValueSingle.OPERATION_AUTO:
				return this.platform.Characteristic.TargetHeatingCoolingState.AUTO;
			case ValueSingle.OPERATION_COOL:
				return this.platform.Characteristic.TargetHeatingCoolingState.COOL;
			case ValueSingle.OPERATION_HEAT:
				return this.platform.Characteristic.TargetHeatingCoolingState.HEAT;

			// there is still these 2 that aren't supported in homekit
			// OPERATION_DEHUMIDIFY = '44',
			// OPERATION_VENTILATION = '45',
			case ValueSingle.OPERATION_DEHUMIDIFY:
				return this.platform.Characteristic.TargetHeatingCoolingState.COOL;
			case ValueSingle.OPERATION_VENTILATION:
				return this.platform.Characteristic.TargetHeatingCoolingState.COOL;

			default:
				return this.platform.Characteristic.TargetHeatingCoolingState.AUTO;
		}
	}

	async handleTargetHeatingCoolingStateSet(state) {
		if (state === this.platform.Characteristic.TargetHeatingCoolingState.OFF) {
			this.device.queuePowerOff();
		}

		if (state === this.platform.Characteristic.TargetHeatingCoolingState.COOL) {
			this.device.queuePowerOn();
			this.device.queueOperationModeUpdate(ValueSingle.OPERATION_COOL);
		}

		if (state === this.platform.Characteristic.TargetHeatingCoolingState.HEAT) {
			this.device.queuePowerOn();
			this.device.queueOperationModeUpdate(ValueSingle.OPERATION_HEAT);
		}

		if (state === this.platform.Characteristic.TargetHeatingCoolingState.AUTO) {
			this.device.queuePowerOn();
			this.device.queueOperationModeUpdate(ValueSingle.OPERATION_AUTO);
		}

		await this.platform.submitDeviceUpdates(this.device);
	}

	handleFanActiveGet() {
		const state = this.handleTargetHeatingCoolingStateGet();
		if (state === this.platform.Characteristic.TargetHeatingCoolingState.OFF) {
			return this.platform.Characteristic.Active.INACTIVE;
		}

		return this.platform.Characteristic.Active.ACTIVE;
	}

	async handleFanActiveSet(state) {
		if (state === this.platform.Characteristic.Active.INACTIVE) {
			this.device.queuePowerOff();
		} else {
			this.device.queuePowerOn();
			this.device.queueTemperatureUpdate(this.device.getTemperature());
		}

		await this.platform.submitDeviceUpdates(this.device);
	}
}
