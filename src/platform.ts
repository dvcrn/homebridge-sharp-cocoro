import { Cocoro, Device } from "cocoro-sdk";
import {
	API,
	Characteristic,
	DynamicPlatformPlugin,
	Logger,
	PlatformAccessory,
	PlatformConfig,
	Service,
} from "homebridge";
import { CocoroDevice } from "./platformAccessory";
import { PLATFORM_NAME, PLUGIN_NAME } from "./settings";

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class SharpCocoroPlatform implements DynamicPlatformPlugin {
	public readonly Service: typeof Service = this.api.hap.Service;
	public readonly Characteristic: typeof Characteristic =
		this.api.hap.Characteristic;

	// this is used to track restored cached accessories
	public readonly accessories: PlatformAccessory[] = [];

	// timeout for making sure we don't spam the API
	private deviceSubmitTimeout;

	private cocoro: Cocoro;

	constructor(
		public readonly log: Logger,
		public readonly config: PlatformConfig,
		public readonly api: API
	) {
		this.log.debug("Finished initializing platform:", this.config.name);

		console.log(config);
		this.cocoro = new Cocoro(config["appSecret"], config["appKey"]);

		// When this event is fired it means Homebridge has restored all cached accessories from disk.
		// Dynamic Platform plugins should only register new accessories after this event was fired,
		// in order to ensure they weren't added to homebridge already. This event can also be used
		// to start discovery of new accessories.
		this.api.on("didFinishLaunching", () => {
			log.debug("Executed didFinishLaunching callback");
			// run the method to discover / register your devices as accessories
			this.discoverDevices();
		});
	}

	/**
	 * This function is invoked when homebridge restores cached accessories from disk at startup.
	 * It should be used to setup event handlers for characteristics and update respective values.
	 */
	configureAccessory(accessory: PlatformAccessory) {
		this.log.info("Loading accessory from cache:", accessory.displayName);

		// add the restored accessory to the accessories cache so we can track if it has already been registered
		this.accessories.push(accessory);
	}

	/**
	 * This is an example method showing how to register discovered accessories.
	 * Accessories must only be registered once, previously created accessories
	 * must not be registered again to prevent "duplicate UUID" errors.
	 */
	async discoverDevices() {
		this.log.debug("Trying to authenticate with SHARP Cocoro API");
		await this.cocoro.login();
		const devices = await this.cocoro.queryDevices();
		this.log.debug(`Authentication success, got ${devices.length} devices`);

		const usedUUIDs: string[] = [];

		for (const device of devices) {
			this.log.debug(`Processing device '${device.name}' (${device.deviceId})`);

			const uuid = this.api.hap.uuid.generate(device.deviceId.toString());
			const existingAccessory = this.accessories.find(
				(accessory) => accessory.UUID === uuid
			);

			usedUUIDs.push(uuid);

			if (existingAccessory) {
				// the accessory already exists
				this.log.info(
					"Restoring existing accessory from cache:",
					existingAccessory.displayName
				);

				// if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
				existingAccessory.context.device = device;
				this.api.updatePlatformAccessories([existingAccessory]);

				// create the accessory handler for the restored accessory
				// this is imported from `platformAccessory.ts`
				new CocoroDevice(this, existingAccessory);
			} else {
				// the accessory does not yet exist, so we need to create it
				this.log.info("Adding new accessory:", device.name);

				// create a new accessory
				const accessory = new this.api.platformAccessory(device.name, uuid);

				// store a copy of the device object in the `accessory.context`
				// the `context` property can be used to store any data about the accessory you may need
				accessory.context.device = device;

				// create the accessory handler for the newly create accessory
				// this is imported from `platformAccessory.ts`
				new CocoroDevice(this, accessory);

				// link the accessory to your platform
				this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
					accessory,
				]);
			}
		}

		// remove platform accessories when no longer present
		this.accessories.forEach((accessory) => {
			if (usedUUIDs.indexOf(accessory.UUID) === -1) {
				this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
					accessory,
				]);
				this.log.info(
					"Removing existing accessory from cache:",
					accessory.displayName
				);
			}
		});
	}

	async fetchDevice(device: Device) {
		await this.cocoro.login();
		return this.cocoro.fetchDevice(device);
	}

	async submitDeviceUpdates(device: Device) {
		this.deviceSubmitTimeout && clearTimeout(this.deviceSubmitTimeout);

		this.deviceSubmitTimeout = setTimeout(() => {
			this.log.debug(
				"submitting device state update to cocoro api",
				device.propertyUpdates
			);

			this.cocoro.executeQueuedUpdates(device);
		}, 1000);
	}
}
