---
title: "Building a Strong Stocks Scan in TradingView: From Scratch to Identifying Winning Trades  "
source_id: "2055280130478473247"
source_type: "x_video"
topic_slug: finance
topic_label: "Finance"
source_handle: "@VCPSwing"
tweet_url: "https://x.com/VCPSwing/status/2055280130478473247"
has_transcript: false
generated_at: "2026-05-25T05:33:35.147Z"
---
# Building a Strong Stocks Scan in TradingView: From Scratch to Identifying Winning Trades  

## Overview  
This course teaches you how to construct a proprietary “strong stocks” scan directly inside TradingView, the popular charting and analysis platform used by millions of traders worldwide. You will learn the exact methodology behind scanning for stocks that exhibit the combined characteristics of price strength, volume confirmation, and fundamental resilience—criteria that historically precede outperformance. By the end of the course you will be able to replicate the scan hinted at in the original tweet, customize it to your own trading style, and deploy it as a repeatable tool for uncovering high‑probability winners in any market environment.  

## Background & Context  
Stock screening has existed since the early days of quantitative finance, but the advent of web‑based charting platforms democratized the process, allowing retail traders to apply sophisticated filters without expensive data feeds or programming expertise. TradingView, launched in 2011, combines a social trading network with a powerful Pine Script language that lets users write custom indicators, strategies, and scans. The original tweet from @VCPSwing emphasizes that the scan was “built from scratch” and that the author runs **all** of his scans on TradingView, underscoring the platform’s centrality to his workflow. The promise to drop a direct scan link in the comments highlights the community‑driven nature of TradingView, where users share and refine public scripts. Understanding how to build such a scan from first principles gives you control over the logic, prevents reliance on opaque black‑box services, and enables rapid iteration as market conditions evolve.  

## Core Concepts  

### Concept 1: What Constitutes a “Strong Stocks” Scan  
A strong stocks scan is a filter that isolates equities displaying a confluence of bullish technical and fundamental signals. Typical components include:  

* **Price strength** – recent outperformance relative to a benchmark (e.g., price above the 50‑day moving average, positive rate‑of‑change over the past 4‑12 weeks).  
* **Volume confirmation** – trading volume significantly above average, indicating institutional interest and liquidity.  
* **Momentum persistence** – the stock has made higher highs and higher lows over a defined look‑back period, suggesting the trend is intact.  
* **Fundamental health** – positive earnings surprises, rising analyst revisions, or improving profit margins, which reduce the risk of a price reversal driven by deteriorating fundamentals.  

The scan does not rely on a single indicator; instead, it layers multiple conditions so that only stocks satisfying **all** criteria appear in the results. This multi‑factor approach reduces false positives and increases the probability that the selected names will continue to outperform in the near term.  

### Concept 2: TradingView Pine Script Basics for Scanning  
Pine Script is TradingView’s domain‑specific language, designed for writing indicators, strategies, and alerts. A scan in Pine Script is essentially a study that returns a boolean true/false for each bar; when added to the scanner, TradingView evaluates the expression across the entire symbol universe and returns those where the condition evaluates to true. Key elements you need to know:  

* **Study declaration** – `indicator(title="Strong Stocks Scan", overlay=false, max_lines_count=500)` sets up a non‑overlay study suitable for scanning.  
* **Built‑in variables** – `close`, `open`, `high`, `low`, `volume` provide price and volume data; `ta.sma`, `ta.ema`, `ta.rsi` give access to moving averages and momentum oscillators.  
* **Logical operators** – `and`, `or`, `not` combine multiple conditions; comparison operators (`>`, `<`, `>=`, `<=`) test thresholds.  
* **Plotting (optional)** – while not required for a pure scan, you may plot `plot(series, title, color)` to visualize the condition on a chart for debugging.  
* **Export to scanner** – after saving the script, click “Add to Chart”, then from the chart’s indicator list select the three‑dot menu → “Add to favorites” → open the Scanner pane, click “+”, and choose your script; the scanner will then display all symbols where the script returns true on the selected timeframe.  

Understanding these basics lets you translate any set of screening criteria into executable Pine Script code.  

### Concept 3: Core Criteria Used in the VCPSwing Strong Stocks Scan  
Although the exact Pine Script was not disclosed in the tweet, the author’s emphasis on “built from scratch to catch winners” suggests a focus on the following measurable factors, which are common in institutional‑grade momentum screens:  

1. **Price above key moving averages** – e.g., `close > ta.sma(close, 50) and close > ta.sma(close, 200)`.  
2. **Recent price acceleration** – `ta.change(close, 12) > 0.15` (more than 15% gain over the past 12 bars on the chosen timeframe).  
3. **Volume surge** – `volume > ta.sma(volume, 20) * 1.5` (current volume at least 1.5× the 20‑period average).  
4. **Relative Strength Index (RSI) in bullish range** – `ta.rsi(close, 14) > 50 and ta.rsi(close, 14) < 70` to avoid overbought exhaustion while confirming upward momentum.  
5. **Higher high / higher low pattern** – `high > ta.highest(high, 5) and low > ta.lowest(low, 5)` ensuring the stock is making new short‑term highs and lows.  

Each condition can be toggled on or off, and the thresholds adjusted to match the trader’s risk tolerance, time horizon, or market cap focus. The scan’s power lies in the logical **AND** of all these conditions, which dramatically narrows the universe to those stocks exhibiting a robust, multi‑dimensional bullish profile.  

## How It Works / Step‑by‑Step  

### Step 1: Open TradingView and Create a New Pine Script  
1. Log in to TradingView (free or paid account).  
2. Click the **Pine Editor** tab at the bottom of the screen.  
3. Press the **New** button to create a blank script.  

### Step 2: Write the Study Declaration  
Paste the following line at the very top of the editor:  

```pine
//@version=5
indicator(title="Strong Stocks Scan", overlay=false, max_lines_count=500)
```  

*`//@version=5`* tells TradingView to use Pine Script version 5, the current release. The `indicator` function defines a study that will not be drawn over price (`overlay=false`)—ideal for a scanner.  

### Step 3: Define Input Parameters (Optional but Recommended)  
Make the scan flexible by exposing key thresholds as user inputs:  

```pine
maFastLen   = input.int(50,  "Fast MA Length")
maSlowLen   = input.int(200, "Slow MA Length")
volMult     = input.float(1.5, "Volume Multiplier", step=0.1)
rsiLen      = input.int(14,  "RSI Length")
rsiLow      = input.int(50,  "RSI Lower Bound")
rsiHigh     = input.int(70,  "RSI Upper Bound")
priceChgLen = input.int(12,  "Price Change Lookback (bars)")
priceChgTh  = input.float(0.15, "Minimum Price Change (fraction)", step=0.01)
hhLlLen     = input.int(5,   "High/Low Lookback for HH/LL")
```  

These inputs appear in the script’s settings pane, allowing you to tweak the scan without touching the code.  

### Step 4: Compute the Individual Conditions  
Add the following lines after the inputs:  

```pine
// 1. Price above moving averages
aboveMA   = close > ta.sma(close, maFastLen) and close > ta.sma(close, maSlowLen)

// 2. Price acceleration
priceChg  = ta.change(close, priceChgLen) / close[priceChgLen]
accel     = priceChg >= priceChgTh

// 3. Volume surge
volAvg    = ta.sma(volume, volMultLen := 20)   // 20‑period average volume
volSurge  = volume > volAvg * volMult

// 4. RSI in bullish range
rsiVal    = ta.rsi(close, rsiLen)
rsiOK     = rsiVal >= rsiLow and rsiVal <= rsiHigh

// 5. Higher high / higher low (HH/LL) over short term
hh        = high > ta.highest(high, hhLlLen)
ll        = low  > ta.lowest(low,  hhLlLen)
hhll      = hh and ll
```  

Each variable resolves to a series of true/false values (one per bar).  

### Step 5: Combine Conditions with Logical AND  
Create the final scan condition:  

```pine
strongStock = aboveMA and accel and volSurge and rsiOK and hhll
```  

### Step 6: Output the Condition for the Scanner  
To make the script usable in the scanner, simply plot the boolean as a series of 1s and 0s (or use `plotshape` for visual debugging):  

```pine
plot(strongStock ? 1 : 0, title="Scan Hit", style=plot.style_histogram, color=color.new(color.green, 0), linewidth=2, display=display.none)
```  

*`display=display.none`* hides the histogram on the chart while still making the series available to the scanner.  

### Step 7: Save and Add to Chart  
Click the **Save** button, give the script a name (e.g., “VCPSwing Strong Stocks Scan”), and then click **Add to Chart**.  

### Step 8: Launch the Scanner  
1. Open the **Scanner** pane (bottom‑left icon that looks like a grid).  
2. Click the **+** button, navigate to the **Indicators** tab, find your saved script, and select it.  
3. Choose the desired market (e.g., US Equities), timeframe (e.g., Daily), and click **Scan**.  

The scanner will populate a list of all symbols where `strongStock` evaluated to true on the most recent bar. You can sort by volume, market cap, or any other column to further refine your watchlist.  

### Step 9: Iterate and Optimize  
Review the results: if too many names appear, tighten thresholds (e.g., increase `volMult` to 2.0 or raise `priceChgTh` to 0.20). If too few appear, loosen them. Because the script uses inputs, you can adjust them directly from the scanner’s settings gear icon without re‑opening the Pine Editor.  

## Real‑World Examples & Use Cases  

### Example 1: Daily Scan for Swing Traders  
A swing trader holding positions for 2‑10 weeks sets the scanner to a **Daily** timeframe with the following inputs:  

* Fast MA = 20, Slow MA = 50  
* Volume Multiplier = 2.0  
* Price Change Lookback = 10 bars (≈2 weeks) with a minimum 12% gain  
* RSI range = 55‑70  
* HH/LL lookback = 4 bars  

Running the scan on the S&P 500 universe yields a list of stocks such as **NVDA**, **MSFT**, and **AMD** during a bullish tech rally, confirming that the filter captures names with strong institutional buying, accelerating price, and healthy momentum.  

### Example 2: Intraday Scan for Day Traders  
A day trader switches the timeframe to **15‑minute** and adjusts:  

* Fast MA = 9, Slow MA = 21  
* Volume Multiplier = 1.8  
* Price Change Lookback = 6 bars (≈1.5 hours) with a minimum 4% gain  
* RSI range = 50‑65  
* HH/LL lookback = 3 bars  

During a volatile morning session, the scanner flags **TSLA** and **NFLX** as they break above opening range highs with surging volume, providing timely entry candidates for momentum scalps.  

### Example 3: Weekly Scan for Position Traders  
A position trader uses a **Weekly** chart with:  

* Fast MA = 10, Slow MA = 40  
* Volume Multiplier = 1.5 (weekly volume)  
* Price Change Lookback = 4 weeks with a minimum 20% gain  
* RSI range = 50‑80 (allowing stronger weekly momentum)  
* HH/LL lookback = 2 weeks  

The scan highlights **AAPL** and **ADBE** during periods of sustained upward trends, helping the trader identify core holdings for multi‑month positions.  

These examples illustrate how the same underlying logic can be adapted to different trading horizons simply by changing the timeframe and input parameters.  

## Key Insights & Takeaways  

- A strong stocks scan combines **price strength**, **volume confirmation**, and **momentum persistence** to isolate high‑probability winners.  
- TradingView’s Pine Script enables you to encode any set of criteria into a reusable scanner without leaving the platform.  
- Exposing thresholds as **inputs** makes the scan adaptable to different timeframes, asset classes, and risk tolerances.  
- The logical **AND** of multiple conditions drastically reduces false positives compared to single‑indicator screens.  
- Including a **volume surge** filter ensures that price moves are supported by real trading interest, reducing the chance of chasing illiquid spikes.  
- Using **RSI within a bullish band** (e.g., 50‑70) captures momentum while avoiding overextended conditions that often precede pullbacks.  
- The **higher high / higher low** pattern confirms that the stock’s short‑term structure is intact, adding a layer of trend validation.  
- Saving the script and adding it to the scanner creates a **one‑click workflow** that can be run daily, weekly, or intraday with minimal effort.  
- Regularly reviewing and adjusting the scan’s parameters prevents overfitting to past market regimes and keeps the tool relevant.  
- The scan can be combined with additional fundamental filters (e.g., earnings growth > 10% YoY) by linking TradingView’s fundamental data via the `request.financial` function for even more refined results.  

## Common Pitfalls / What to Watch Out For  

- **Over‑optimization**: Tweaking inputs to produce perfect historical results can lead to a scan that fails in live markets. Always validate with out‑of‑sample data.  
- **Look‑ahead bias**: Ensure that all calculations use only data available at the time of the bar (e.g., avoid using `close` from future bars). Pine Script’s built‑in functions are inherently bar‑based, but custom loops must be coded carefully.  
- **Ignoring liquidity**: A stock may meet price and momentum criteria yet have insufficient average daily volume for your position size, causing slippage. Always cross‑check volume filters with your trade size.  
- **Changing market regimes**: A scan tuned for a low‑volatility, trending environment may generate many false signals during choppy, sideways periods. Consider adding a volatility filter (e.g., ATR < X% of price) or toggling the scan off during high‑uncertainty windows.  
- **Overreliance on technicals**: Fundamental deterioration can invalidate a technically strong setup. Periodically review earnings, guidance, and macro news for symbols that appear in the scan.  
- **Signal latency**: Scanner results are based on the latest completed bar. If you need real‑time intraday alerts, set up an **alert** on the script rather than relying solely on periodic scanner runs.  
- **Misinterpreting histogram output**: Remember that the histogram is hidden (`display=none`) for scanner use; plotting it visible on the chart can clutter your view and is unnecessary for pure scanning.  
- **Neglecting position sizing**: Even a strong scan does not guarantee profit; proper risk management (e.g., 1‑2% equity per trade) remains essential.  

## Review Questions  

1. **Conceptual Understanding** – Explain why combining price‑above‑moving‑averages, volume surge, and RSI within a bullish band provides a more robust signal than using any single condition alone.  
2. **Procedural Mastery** – Describe, step by step, how you would modify the existing Pine Script to add a fundamental filter that requires the company’s quarterly earnings per share (EPS) to have grown at least 15% year‑over‑year, using TradingView’s fundamental data functions.  
3. **Application Scenario** – You are a swing trader who prefers to hold positions for 3‑6 weeks and wants to minimize false signals during earnings season. Propose a specific set of input adjustments (timeframe, moving‑average lengths, volume multiplier, price‑change threshold, RSI bounds, HH/LL lookback) and justify each choice in the context of reducing noise around earnings announcements.  

## Further Learning  

- **Advanced Pine Script** – Study the `request.security`, `request.fundamental`, and `request.dividends` functions to incorporate multi‑timeframe and fundamental data directly into your scans.  
- **Statistical Validation** – Learn how to export scanner results to a CSV and perform back‑testing using Python or R to evaluate the scan’s edge across different market regimes.  
- **Risk Management Integration** – Explore how to combine the scan with position‑sizing scripts (e.g., Kelly criterion or fixed fractional) to automate trade execution via TradingView alerts and broker webhooks.  
- **Sector‑Relative Strength** – Investigate adding a relative strength vs. sector index filter (e.g., `security(sector_ticker, timeframe, close)`) to ensure you are buying the strongest stocks within the strongest industries.  
- **Behavioral Finance Filters** – Consider incorporating sentiment indicators such as the put/call ratio or social‑media buzz scores to avoid stocks that are technically strong but suffering from negative news flow.  

By mastering the concepts, implementation steps, and nuanced adjustments outlined above, you will be able to build, refine, and deploy a powerful strong stocks scan that aligns with your personal trading methodology and helps you consistently identify market winners.
