const express = require('express');
const router = express.Router();
const mustache = require('mustache');
const fs = require('fs');
const adhan = require('adhan');
const livereload = require("livereload");
const connectLivereload = require("connect-livereload");
var { DateTime } = require('luxon');
const { exec } = require("child_process");

var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function ConfigClass() {
    const CONFIG_PATH = "config.json";
    this.configData = {};

    this.ReadConfig = () => {
        fs.readFile(CONFIG_PATH, 'utf8', (err, data) => {
            if (err) {
                this.configData = {
                    "masjid_name": "My Masjid",
                    "jummah_adhan": "12:30 PM",
                    "jummah_iqama": "12:30 PM",
                    "messages": [
                        "Message 1",
                        "Message 2",
                        "Message 3"
                    ],
                    "messages_extra": [
                        "Extra Message 1",
                        "Extra Message 2",
                        "Extra Message 3"
                    ],
                    "message_display_time": 10,
                    "lat": 0.000000,
                    "long": 0.000000,
                    "format": "12",
                    "fajr_iqama": 60,
                    "dhuhr_iqama": 60,
                    "asr_iqama": 60,
                    "maghrib_iqama": 60,
                    "isha_iqama": 60,
                    "orientation": "normal"
                };
                return;
            }
            this.configData = JSON.parse(data);
        });
    }

    this.SaveConfig = (callback) => {
        fs.writeFile(CONFIG_PATH, JSON.stringify(this.configData), (err) => {
            if (err){
                callback(false);
            }else {
                callback(true);
            }
        });
    }
}

var config = new ConfigClass();

function getPrayerTimes() {
    var coordinates = new adhan.Coordinates(config.configData["lat"], config.configData["long"]);
    var params = adhan.CalculationMethod.NorthAmerica();
    params.madhab = adhan.Madhab.Shafi;
    prayer_times = new adhan.PrayerTimes(coordinates, new Date(), params);
    return prayer_times;
}

function getRenderedPage(page, data, callback) {
    let rendered = "";
    fs.readFile(__dirname + '/' + page, 'utf8', (err, html) => {
        if (err) { throw err; }
        rendered = mustache.render(html, data);
        callback(rendered);
    });
}

function convertPrayerTime(prayerTime) {
    let result = "";
    switch (config.configData["format"]) {
        case "24":
            let date = new Date(prayerTime);
            result = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
            break;
        case "12":
        default:
            result = DateTime.fromJSDate(prayerTime).toLocaleString(DateTime.TIME_SIMPLE);
            break;
    }
    return result;
}

function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60000);
}

function checkIfObjectExists(obj) {
    return (obj != null && obj != undefined);
}

function getPageData() {
    let date = new Date();
    let data = JSON.parse(JSON.stringify(config.configData));

    data["message_original_display_time"] = data["message_display_time"];
    data["message_display_time"] = checkIfObjectExists(data["message_display_time"]) ? data["message_display_time"] * 1000 : 10000;

    data["current_date"] = `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;

    switch (checkIfObjectExists(data["orientation"]) ? data["orientation"] : "") {
        case "left":
        case "right":
            data["css_style"] = [
                `./css/prayer_times_vertical_common.css`,
                `./css/prayer_times_vertical_${data["orientation"]}.css`
            ];
            break;
        case "normal":
        case "flipped":
            data["css_style"] = [
                `./css/prayer_times_horizontal_common.css`,
                `./css/prayer_times_horizontal_${data["orientation"]}.css`
            ];
            break;
        default:
            data["css_style"] = [
                `./css/prayer_times_vertical_common.css`,
                `./css/prayer_times_vertical_left.css`,
            ];
            break;
    }

    if (!checkIfObjectExists(data["messages_extra"])) {
        data["messages_extra"] = [];
    }

    let prayer_times = getPrayerTimes();
    ["fajr", "dhuhr", "asr", "maghrib", "isha"].forEach((prayer) => {
        data[prayer] = {};
        data[prayer]["adhan"] = convertPrayerTime(prayer_times[prayer]);
        data[prayer]["iqama"] = convertPrayerTime(
            addMinutes(prayer_times[prayer],
                checkIfObjectExists(data[`${prayer}_iqama`])
                    ?
                    data[`${prayer}_iqama`]
                    :
                    10
            ));
    });

    return data;
}

function setupServer() {
    const liveReloadServer = livereload.createServer();
    liveReloadServer.watch(__dirname + '/');

    app = express();

    router.get('/', (req, res) => {
        getRenderedPage("public/prayer_times.html", getPageData(), (data, err) => {
            res.send(data);
        });
    });

    router.get('/info', (req, res) => {
        res.send(getPageData());
    });

    router.get('/config', (req, res) => {
        getRenderedPage("public/config.html", getPageData(), (data, err) => {
            res.send(data);
        });
    });

    router.post('/config', (req, res) => {
        for (const key in req.body) {
            if (key in config.configData) {
                config.configData[key] = req.body[key];
            }
        }

        for (let i = 0; i < config.configData["messages"].length; i++) {
            config.configData["messages"][i] = config.configData["messages"][i].replace(/\n/g, "<br>");
        }

        for (let i = 0; i < config.configData["messages_extra"].length; i++) {
            config.configData["messages_extra"][i] = config.configData["messages_extra"][i].replace(/\n/g, "<br>");
        }

        config.SaveConfig((status) => {
            if(status){
                res.send(`<a href="./config">Successfully saved config!</a>`);
            }else{
                res.send(`<a href="./config">Failed saving config!</a>`);
            }
        });
    })

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(connectLivereload());
    app.use(express.static(__dirname + '/public/'));
    app.use('/', router);
    app.listen(9000);

    liveReloadServer.server.once("connection", () => {
        setTimeout(() => {
            liveReloadServer.refresh("/");
        }, 100);
    });
}

config.ReadConfig();
setupServer();