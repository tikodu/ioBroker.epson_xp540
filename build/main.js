"use strict";
/*
 * Created with @iobroker/create-adapter v1.31.0
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const utils = __importStar(require("@iobroker/adapter-core"));
const fetch = __importStar(require("node-fetch"));
class EpsonXp540 extends utils.Adapter {
    constructor(options = {}) {
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
    async onReady() {
        this.log.info('Adapter starting.');
        this.setState('info.connection', false, true);
        let intervalInMinutes = 5;
        if (this.config.internvalInMinutes >= 1 && this.config.internvalInMinutes <= 60) {
            intervalInMinutes = this.config.internvalInMinutes;
        }
        this.log.info('update internval is ' + intervalInMinutes + ' minute(s).');
        await this.setObjectNotExistsAsync('info.updateInterval', {
            type: 'state',
            common: {
                name: 'Update interval in minutes',
                type: 'number',
                role: 'value',
                unit: 'minutes',
                read: true,
                write: false,
            },
            native: {},
        });
        this.log.info('Init periodic update...');
        this._periodicUpdate = setInterval(this.fetchAllInformation, intervalInMinutes * 1000 * 60);
        this.fetchAllInformation();
        this.log.info('Adapter initialized.');
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    onUnload(callback) {
        try {
            if (this._periodicUpdate) {
                clearInterval(this._periodicUpdate);
            }
            callback();
        }
        catch (e) {
            callback();
        }
    }
    replaceAll(base, search, replace) {
        return base.split(search).join(replace);
    }
    async updatePrinterInfo(html) {
        this.log.info('update printer info');
        const matchKeys = html.match(/<td\s+class="item-key"><bdi>[\S\s]*?<\/bdi>/gi);
        const matchValues = html.match(/<td\s+class="item-value">[\S\s]*?<\/td>/gi);
        if (matchKeys && matchValues && matchKeys.length === matchValues.length) {
            for (let i = 0; i < matchKeys.length; i++) {
                const originalKey = matchKeys[i].replace(/(<\/?[^>]+>)/gi, '');
                const value = matchValues[i].replace(/(<\/?[^>]+>)/gi, '');
                let key = originalKey.toLowerCase();
                key = this.replaceAll(key, ' ', '_');
                key = this.replaceAll(key, '-', '_');
                key = this.replaceAll(key, '.', '_');
                key = this.replaceAll(key, ':', '_');
                key = this.replaceAll(key, 'ä', 'ae');
                key = this.replaceAll(key, 'ö', 'oe');
                key = this.replaceAll(key, 'ü', 'ue');
                key = this.replaceAll(key, 'ß', 'ss');
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
    async updateInkCartridgeInfo(html) {
        this.log.info('update ink cartridge info');
        const matchKeys = html.match(/<div\s+class='clrname'>(.*?)</g);
        const matchValues = html.match(/.PNG'\s+height='(.*?)'\s+style=''>/g);
        if (matchKeys && matchValues && matchKeys.length === matchValues.length) {
            for (let i = 0; i < matchKeys.length; i++) {
                let key = matchKeys[i];
                key = key.replace("<div class='clrname'>", '');
                key = key.replace('<', '');
                key = key.toLowerCase();
                let value = matchValues[i];
                value = value.replace(".PNG' height='", '');
                value = value.replace("' style=''>", '');
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
    fetchAllInformation() {
        this.log.info('updating infos...');
        try {
            const url = `http://${this.config.ip}/PRESENTATION/HTML/TOP/PRTINFO.HTML`;
            fetch
                .default(url)
                .then((res) => {
                if (res.ok) {
                    return res.text();
                }
                else {
                    throw Error(res.statusText);
                }
            })
                .then(async (htmlBody) => {
                await this.updatePrinterInfo(htmlBody);
                await this.updateInkCartridgeInfo(htmlBody);
                await this.setStateAsync('info.connection', true, true);
                this.log.info('updating infos successfull');
            });
        }
        catch (e) {
            this.setState('info.connection', false, true);
            this.log.error(e);
        }
    }
}
if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options) => new EpsonXp540(options);
}
else {
    // otherwise start the instance directly
    (() => new EpsonXp540())();
}
