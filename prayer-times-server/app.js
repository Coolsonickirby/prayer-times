const hijri = require('hijri-date');
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

var hijri_days = ["Ahad", "Ithnin", "Thulatha", "Arbaa", "Khams", "Jumuah", "Sabt"];
var hijri_months = ["Muharram", "Safar", "Rabi'ul Awwal", "Rabi'ul Akhir", "Jumadal Ula", "Jumadal Akhira", "Rajab", "Sha'ban", "Ramadan", "Shawwal", "Dhul Qa'ada", "Dhul Hijja"];

Date.prototype.addDays = function(days) {
    var date = new Date(this.valueOf());
    date.setDate(date.getDate() + days);
    return date;
}

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
                    "orientation": "normal",
                    "hijri_day_offset": 0
                };
                return;
            }
            this.configData = JSON.parse(data);
        });
    }

    this.SaveConfig = (callback) => {
        fs.writeFile(CONFIG_PATH, JSON.stringify(this.configData), (err) => {
            if (err) {
                callback(false);
            } else {
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
            result = DateTime.fromJSDate(prayerTime).toFormat("h:mm a");
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

function getPageData(config_page = false) {
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
        data[prayer]["iqama"] = checkIfObjectExists(data[`${prayer}_iqama_static`]) && data[`${prayer}_iqama_static`] != "" && !config_page ? data[`${prayer}_iqama_static`] : convertPrayerTime(
            addMinutes(prayer_times[prayer],
                checkIfObjectExists(data[`${prayer}_iqama`]) ?
                data[`${prayer}_iqama`] :
                10
            ));
    });

    var hijri_info = date.addDays(checkIfObjectExists(data["hijri_day_offset"]) ? parseInt(data["hijri_day_offset"]) : 0).toHijri();
    data["current_date"] = data["current_date"] + `<br>${hijri_days[hijri_info.getDay()]}, ${hijri_months[hijri_info.getMonth() - 1]} ${hijri_info.getDate()}`;
    console.log(data);
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
        getRenderedPage("public/config.html", getPageData(true), (data, err) => {
            res.send(data);
        });
    });

    router.post('/config', (req, res) => {
        for (const key in req.body) {
            config.configData[key] = req.body[key];
        }

        config.SaveConfig((status) => {
            if (status) {
                res.send(`<h1><a href="./config">Successfully saved config!</a></h1>`);
            } else {
                res.send(`<h1><a href="./config">Failed saving config!</a></h1>`);
            }
        });

        liveReloadServer.refresh("/");
    })

    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(connectLivereload());
    app.use(express.static(__dirname + '/public/'));
    app.use('/', router);
    app.listen(9000);
}

config.ReadConfig();
setupServer();