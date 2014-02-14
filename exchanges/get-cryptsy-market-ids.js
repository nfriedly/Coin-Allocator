#!/usr/bin/env node

var request = require('request');
var _ = require('lodash');

request('http://pubapi.cryptsy.com/api.php?method=marketdatav2', function (error, response, body) {
// to test locally, save a file named marketdata.json and then comment the above line and uncomment the below one:
//require('fs').readFile('./marketdata.json', function(error, body) { body = body.toString(); var response = { statusCode: 200 };
    if (!error && response.statusCode == 200) {
        try {
            // strip out the useless data, sort by marketId, and then turn it (back) into an object keyed by market label for quick lookups
            var json = JSON.parse(body);
            var markets = json['return'].markets;
            var marketIds = _.map(markets, function(market) {
                return _.pick(market, ["label", "marketid", "primaryname", "primarycode", "secondaryname", "secondarycode"]);
            })
            .sort(function(a, b) {
                return a.marketid - b.marketid;
            });
            marketIds = _.zipObject(_.pluck(marketIds, 'label'), marketIds);
            // output from the node.js built-in pretty-printer is not valid json (according to node.js).
            // so this creates unformated JSON and then adds a small amount of formatting
            console.log(JSON.stringify(marketIds).replace(/},/g, '},\n'));
        } catch (ex) {
            console.error('Response from cryptsy in unexpected format', ex);
            process.exit(2);
        }
    } else {
        console.error('Error downloading market data from cryptsy\nError: %s\nStatus: %s\n\n', error, response.statusCode, body);
        process.exit(1);
    }
});
