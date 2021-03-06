/*
 * Created with @iobroker/create-adapter v1.31.0
 */

import * as utils from '@iobroker/adapter-core';
import * as fetch from 'node-fetch';

class EpsonXp540 extends utils.Adapter {
	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: 'epson_xp540',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	private async onReady(): Promise<void> {
		this.log.info('Adapter started. Try to retrieve data...');
		if (this.config?.ip !== null && this.config?.ip !== undefined && this.config.ip !== '') {
			try {
				const url = `http://${this.config.ip}/PRESENTATION/HTML/TOP/PRTINFO.HTML`;
				const response = await fetch.default(url);
				if (response.ok) {
					this.log.info('Data has been received. Try to handle data...');
					const htmlBody = await response.text();
					await this.updatePrinterInfo(htmlBody);
					await this.updateInkCartridgeInfo(htmlBody);
					this.log.info('All data handled.');
					this.stopAdapter();
				} else {
					this.log.warn(`Response has status ${response.status} - ${response.statusText}`);
				}
			} catch (e) {
				this.handleFetchError(e);
			}
		} else {
			this.log.warn('Data cannot be retrieved. Please configure a valid IP or hostname.');
			this.stopAdapter(true);
		}
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 */
	private onUnload(callback: () => void): void {
		try {
			callback();
		} catch (e) {
			callback();
		}
	}

	private handleFetchError(e: any): void {
		if (e && e.code && e.code == 'ETIMEDOUT') {
			this.log.warn(
				'Timeout during connection setup. Please check the IP or hostname and switch on the printer.',
			);
		} else {
			this.log.info('An error occurred while retrieving or handling the data.');
			this.log.error(JSON.stringify(e));
		}
		this.stopAdapter(true);
	}

	private stopAdapter(withError = false): void {
		this.terminate
			? this.terminate('Adapter stopped until next schedule moment.', withError ? 1 : 0)
			: process.exit(0);
	}

	private replaceAll(base: string, search: string, replace: string): string {
		return base.split(search).join(replace);
	}

	private transformToValidKeyForIobroker(key: string): string {
		let transformedKey = key.toLowerCase();
		transformedKey = this.replaceAll(transformedKey, ' ', '_');
		transformedKey = this.replaceAll(transformedKey, '-', '_');
		transformedKey = this.replaceAll(transformedKey, '.', '_');
		transformedKey = this.replaceAll(transformedKey, ':', '_');
		transformedKey = this.replaceAll(transformedKey, 'ä', 'ae');
		transformedKey = this.replaceAll(transformedKey, 'ö', 'oe');
		transformedKey = this.replaceAll(transformedKey, 'ü', 'ue');
		transformedKey = this.replaceAll(transformedKey, 'ß', 'ss');
		return transformedKey;
	}

	private async updatePrinterInfo(html: string): Promise<void> {
		this.log.info('Updating printer info...');
		const matchKeys = html.match(/<td\s+class="item-key"><bdi>[\S\s]*?<\/bdi>/gi);
		const matchValues = html.match(/<td\s+class="item-value">[\S\s]*?<\/td>/gi);
		if (matchKeys && matchValues && matchKeys.length === matchValues.length) {
			for (let i = 0; i < matchKeys.length; i++) {
				const originalKey = matchKeys[i].replace(/(<\/?[^>]+>)/gi, '');
				const key = this.transformToValidKeyForIobroker(originalKey);
				const value = matchValues[i].replace(/(<\/?[^>]+>)/gi, '');

				await this.setObjectNotExistsAsync(`printer.${key}`, {
					type: 'state',
					common: {
						name: `${originalKey}`,
						type: 'string',
						role: 'value',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setStateAsync(`printer.${key}`, value, true);
			}
		}
	}

	private async updateInkCartridgeInfo(html: string): Promise<void> {
		this.log.info('Updating ink cartridge info...');
		const matchKeys = html.match(/<div\s+class='clrname'>(.*?)</g);
		const matchValues = html.match(/.PNG'\s+height='(.*?)'\s+style=''>/g);

		if (matchKeys && matchValues && matchKeys.length === matchValues.length) {
			for (let i = 0; i < matchKeys.length; i++) {
				const key = matchKeys[i].replace("<div class='clrname'>", '').replace('<', '').toLowerCase();
				const value = matchValues[i].replace(".PNG' height='", '').replace("' style=''>", '');
				const level = (parseInt(value, 10) * 100) / 50;

				await this.setObjectNotExistsAsync(`ink.${key}`, {
					type: 'state',
					common: {
						name: `${key.toUpperCase()}`,
						type: 'number',
						role: 'value',
						unit: '%',
						read: true,
						write: false,
					},
					native: {},
				});
				await this.setStateAsync(`ink.${key}`, level, true);
			}
		}
	}
}

if (module.parent) {
	// Export the constructor in compact mode
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new EpsonXp540(options);
} else {
	// otherwise start the instance directly
	(() => new EpsonXp540())();
}
