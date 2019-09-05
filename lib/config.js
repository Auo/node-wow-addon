const path = require('path');
const fs = require('fs');
const jsonfile = require('jsonfile')

class Config {
    constructor(installationPath) {
        if (!installationPath || typeof installationPath !== 'string') {
            throw new Error('installation path is empty or wrong type');
        }

        this.addonsFilePath = path.join(installationPath, 'addons.json');

        if (!this._fileExists(this.addonsFilePath)) {
            fs.writeFileSync(this.addonsFilePath, JSON.stringify({ addons: [] }));
        }
    }

    get() {
        return jsonfile.readFileSync(this.addonsFilePath);
    }

    set(config) {
        jsonfile.writeFileSync(this.addonsFilePath, config);
    }

    _fileExists(path) {
        try {
            fs.accessSync(path, fs.F_OK);
            return true
        } catch (e) {
            return false
        }
    }
}

module.exports = Config;