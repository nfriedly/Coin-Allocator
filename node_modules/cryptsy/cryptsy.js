var crypto = require('crypto');
var querystring = require('querystring');
var request = require('request');

/**
 * Cryptsy
 *
 * @param {string} key    API Key
 * @param {string} secret API Secret
 */
var Cryptsy = function(key, secret) {
    this.key = key;
    this.secret = secret;
    this.nonce = Math.floor((new Date()).getTime() / 1000);
    this.userAgent = 'Mozilla/4.0 (compatible; Cryptsy API Node.js client; NodeJS/' + process.version + ')';

    this.privateApiUrl = 'https://www.cryptsy.com/api';
    this.publicApiUrl = 'http://pubapi.cryptsy.com/api.php?';

    this.publicMethods = [
        'marketdata', 'marketdatav2', 'singlemarketdata', 'orderdata', 'singleorderdata'
    ];

    this.privateMethods = [
        'getinfo', 'getmarkets', 'mytransactions', 'markettrades', 'marketorders', 'mytrades',
        'allmytrades', 'myorders', 'depth', 'allmyorders', 'createorder', 'cancelorder',
        'cancelmarketorders', 'cancelallorders', 'calculatefees', 'generatenewaddress'
    ];
}

/**
 * API call
 *
 * @param  {string}   method   API Method
 * @param  {object}   params   Method parameters
 * @param  {Function} callback (err, data)
 */
Cryptsy.prototype.api = function(method, params, callback) {
    params = params || {};
    params.method = method;
    params.nonce = ++this.nonce;
    if (this.publicMethods.indexOf(method) >= 0) {
        this.getRequest(params, callback);
    } else if (this.privateMethods.indexOf(method) >= 0) {
        this.postRequest(params, callback);
    } else {
        callback(new Error('Unknown method: ' + method), null);
    }
}

/**
 * Creates a Base64 signature of the request
 *
 * @param  {string} str Text string
 * @return {string}     Base64 encoded signature
 */
Cryptsy.prototype.getSignatureFromString = function(str) {
    var hmac = new crypto.createHmac('sha512', this.secret);
    hmac.update(str);
    return hmac.digest('hex');
}

/**
 * HTTP GET request
 *
 * @param  {Object}   params   GET parameters
 * @param  {Function} callback (err, data)
 */
Cryptsy.prototype.getRequest = function(params, callback) {
    var options = {
        url: this.publicApiUrl + querystring.stringify(params),
        method: 'GET',
        headers: {
            'User-Agent': this.userAgent,
        }
    }
    request.get(options, function (err, response, body) {
        this.parseResponse(err, response, body, callback);
    }.bind(this));
}

/**
 * HTTP POST request
 *
 * @param  {Object}   params   POST parameters
 * @param  {Function} callback (err, data)
 */
Cryptsy.prototype.postRequest = function(params, callback) {
    var options = {
        url: this.privateApiUrl,
        method: 'POST',
        form: params,
        headers: {
            'Sign': this.getSignatureFromString(querystring.stringify(params)),
            'Key': this.key,
            'User-Agent': this.userAgent,
        }
    };

    request.post(options, function (err, response, body) {
        this.parseResponse(err, response, body, callback);
    }.bind(this));
}

/**
 * Parse server response
 *
 * @param  {[type]}   err      [description]
 * @param  {[type]}   response [description]
 * @param  {[type]}   body     [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
Cryptsy.prototype.parseResponse = function(err, response, body, callback) {
    if (err) {
        callback(new Error('Error in server response: ' + JSON.stringify(err)), null);
    } else {
        if (typeof callback === 'function') {
            var data = null;
            var err = null;
            try {
                data = JSON.parse(body);
            } catch(e) {
                err = new Error('Error parsing JSON: ' + body);
            }
            if (err) {
                callback(err, data);
            } else {
                if (data && !!(data.success|0) && data.return) {
                    callback(err, data.return);
                } else {
                    if (data && data.error) {
                        err = new Error(data.error);
                    } else {
                        err = new Error('Unknown error');
                    }
                    callback(err, null);
                }
            }
        }
    }
}

module.exports = Cryptsy;
