Coin Allocator
==============

Taking the lessons from [The Intelligent Asset Allocator](http://www.amazon.com/gp/product/0071362363/ref=as_li_ss_il?ie=UTF8&camp=1789&creative=390957&creativeASIN=0071362363&linkCode=as2&tag=nfriedly-20) and applying them to BitCoin and friends via [Cryptsy](https://www.cryptsy.com/users/register?refid=154285).

Currently just reviews your balances and suggests a new allocation. I plan on adding automatic rebalancing in the future.

Setup
-----

[Turn on the API](https://www.cryptsy.com/users/settings) and set your `CRYPTSY_PUBLIC_KEY` and `CRYPTSY_PRIVATE_KEY` env vars to the appropriate values, then run `node index.js`. 

You may also want to edit the `currencies` and `primaryCurrency` lines in `index.js`. 

Note: all of your currencies must be directly convertible to your primary currency via the cryptsy API, or it will fail.

Common Issues
-------------

Cryptsy's API frequently dies. In that case, you'll see an error message, usually with something about 'Error parsing JSON' and some HTML telling you about a 'Bad Gateway'. If that happens, just wait a minute or two and try again.

Todo
----

* Suggest trades to-and-from primary currency to rebalance account
* Optimize trades to skip primary currency when appropriate (goal is lower total trade volume)
* Create threshold of when to skip a trade 
* Find appropriate value for the above threshold
* Add option to automatically execute suggested trades
* Finish testing Cryptsy API wrapper
* Test core code
* add jsbeautify tasks
* Automate tests
* Set up live instance to rebalance my account
* Separate CLI from core lib
* Support allocation by percentage
* Support auto-selling balances in non-target currencies
* Better error for bogus / unsupported currencies
* Support A->B->C paths even when B is not a requested currency
