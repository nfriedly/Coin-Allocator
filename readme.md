Coin Allocator
==============

[![Build Status](https://travis-ci.org/nfriedly/Coin-Allocator.png?branch=master)](https://travis-ci.org/nfriedly/Coin-Allocator)

Taking the lessons from [The Intelligent Asset Allocator](http://www.amazon.com/gp/product/0071362363/ref=as_li_ss_il?ie=UTF8&camp=1789&creative=390957&creativeASIN=0071362363&linkCode=as2&tag=nfriedly-20) and applying them to BitCoin and friends via [Cryptsy](https://www.cryptsy.com/users/register?refid=154285).

Currently just reviews your balances and suggests a new allocation and a naive set of trades to get there. I plan optimizing the trades to reduce the fees and take advantage of any arbitrage opportunities, and then give the option to automatically rebalance using the optimized trades.

Setup
-----

[Turn on the API](https://www.cryptsy.com/users/settings) and set your `CRYPTSY_PUBLIC_KEY` and `CRYPTSY_PRIVATE_KEY` env vars to the appropriate values, then run `node cli.js`. 

You may also want to edit the `currencies` and `primaryCurrency` lines in `cli.js`. 

Note: all of your currencies must be directly convertible to your primary currency via the cryptsy API, or it will fail. (This means, in effect, that your primary currency must be BTC or LTC). I plan on adding the ability to find indirect paths from one currency to another eventually.

Common Issues
-------------

Cryptsy's API frequently dies. In that case, you'll see an error message, usually with something about 'Error parsing JSON' and some HTML telling you about a 'Bad Gateway'. If that happens, just wait a minute or two and try again.

Todo
----

* Clean up CLI and add `npm install -g` support
* Optimize trades to lower fees and take advantage of any arbitrage opportunities
* Create threshold of when to skip a trade and find an appropriate default value
* Add option to automatically execute suggested trades
* Set up live instance to rebalance my account
* Support allocation by percentage
* Support auto-selling balances in non-target currencies
* Better error for bogus / unsupported currencies
* Support A->B->C paths even when B is not a requested currency
* Add support for BTC-e (and other exchanges?)
