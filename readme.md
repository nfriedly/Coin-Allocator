Coin Allocator
==============

[![Build Status](https://travis-ci.org/nfriedly/Coin-Allocator.png?branch=master)](https://travis-ci.org/nfriedly/Coin-Allocator)

Taking the lessons from [The Intelligent Asset Allocator](http://www.amazon.com/gp/product/0071362363/ref=as_li_ss_il?ie=UTF8&camp=1789&creative=390957&creativeASIN=0071362363&linkCode=as2&tag=nfriedly-20) and applying them to BitCoin and friends via [Cryptsy](https://www.cryptsy.com/users/register?refid=154285).

Takes your target allocation* and your current balances and suggests a set of trades to rebalance while optimizing for lowest fees and number of trades. Then, optionally, executes those trades for you.

* Currently, only equal allocations are supported. Arbitrary percentages will be supported soon.

WARNING
------------

This software is in alpha stage. It is incomplete and almost guaranteed to have bugs. Using it may cause you to loose money or experience other issues. You have been warned.

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

* Clean up CLI - try out https://github.com/chevex/yargs
* Make the exchange provide subclasses of the Trade & TradeSet objects, make them perform validation at creation time
* Figure out minimum exchange amounts (scrape? tiny fake transactions?)
* Make Trade Objects throw on creation if amount is below minimum exchange amount
* Set up live instance to rebalance my account
* Support allocation by percentage
* Support 0% to auto-sell
* Better error for bogus / unsupported currencies
* Support A->B->C paths even when B is not a requested currency
* Add support for BTC-e (and other exchanges?)
* Calculate Amount lost to fees with a given trade set
* Calculate expected balances after a trade set is executed
* Calculate total gained over time (perhaps belongs outside of this library?)
* Split optimizer (& tests) into separate file
* Figure out better names for executing/executed/orderProgress events - maybe order/progress/trade?
