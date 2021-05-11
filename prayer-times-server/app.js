const express = require('express');
const router = express.Router();
const mustache = require('mustache');
const fs = require('fs');
const adhan = require('adhan');
const livereload = require("livereload");
const connectLivereload = require("connect-livereload");
var { DateTime } = require('luxon');

var days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function ConfigClass(){
    this.configData = {};

    this.ReadConfig = () => {
        fs.readFile('config.json', 'utf8', (err, data) => {
            if (err) { throw err; }
            this.configData = JSON.parse(data);
        });
    }
}

var config = new ConfigClass();

function getPrayerTimes() {
    var coordinates = new adhan.Coordinates(config.configData["lat"], config.configData["long"]);
    var params = adhan.CalculationMethod.NorthAmerica();
    params.madhab = adhan.Madhab.Hanafi;
    prayer_times = new adhan.PrayerTimes(coordinates, new Date(), params);
    return prayer_times;
}

function getRenderedPage(page, data, callback){
    let rendered = "";
    fs.readFile(__dirname + '/' + page, 'utf8', (err, html) => {
        if (err) { throw err; }
        rendered = mustache.render(html, data);
        callback(rendered);
    });
}

function convertPrayerTime(prayerTime){
    let result = "";
    switch(config.configData["format"]){
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
    return new Date(date.getTime() + minutes*60000);
}

function checkIfObjectExists(obj){
    return (obj != null && obj != undefined);
}

function getPageData(){
    let date = new Date();
    let data = JSON.parse(JSON.stringify(config.configData));

    data["message_display_time"] = checkIfObjectExists(data["message_display_time"]) ? data["message_display_time"] * 1000 : 10000;

    data["current_date"] = `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;

    let prayer_times = getPrayerTimes();
    ["fajr", "dhuhr", "asr", "maghrib", "isha"].forEach((prayer) => {
        data[prayer] = {};
        data[prayer]["adhan"] = convertPrayerTime(prayer_times[prayer]); 
        data[prayer]["iqama"] = convertPrayerTime(
            addMinutes(prayer_times[prayer], 
                checkIfObjectExists(data[`${prayer}_iqama`] )
                ? 
                data[`${prayer}_iqama`]
                :
                10
            ));
    });

    return JSON.stringify(data);
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
    })

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