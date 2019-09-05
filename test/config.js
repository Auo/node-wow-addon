const test = require('tape')
const path = require('path')
const addonRoot = path.join(__dirname, 'mock')
const Config = require('../lib/config');

test('correct stored data', t => {
    t.plan(1)

    const config = new Config(addonRoot);

    const cfg = {
        "addons": [
            {
                "name": "some-name",
                "folders": [],
                "link": "",
                "version": "",
                "portal": "curse"
            }
        ]
    }
    config.set(cfg);

    t.equal(JSON.stringify(config.get()), JSON.stringify(cfg))
})