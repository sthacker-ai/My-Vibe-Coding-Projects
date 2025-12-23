import datetime
import warnings
import numpy as np
import pandas as pd
from tqdm import tqdm
warnings.filterwarnings('ignore')


def generate_15mins_candle(filepath, excel=True):
    """
    this function generates 15 minutes candle data from raw data
    :param filepath: raw file path
    :param excel: Default True to generate excel output
    :return: execl / Dataframe
    """
    base15minsdata = list()     # container for all 15 mins candle
    dfs = pd.read_csv(filepath, names=['Ticket', 'Date', 'Time', 'Open', 'High', 'Low', 'Close', 'Volume', 'OI'],
                      parse_dates={'datetime': ['Date', 'Time']}, low_memory=False)
    print('\n Number of rows', dfs.shape[0])
    tickets = dfs.groupby('Ticket')     # group data by Ticket name
    for ticket in tickets:
        workingdates = list(set(ticket[1]['datetime'].dt.date.tolist()))    # get all unique dates
        workingdates.sort()
        for date1 in tqdm(workingdates):
            # get data by date
            daydf = ticket[1][ticket[1]['datetime'].dt.date == date1]
            # data with pre market data for day
            premarket = daydf[daydf['datetime'].dt.strftime('%H:%M') <= '09:15']

            # postmarket = daydf[daydf['datetime'].dt.strftime('%H:%M') >= '15:31']

            markettime = daydf[(daydf['datetime'].dt.strftime('%H:%M') <= '15:30') &
                               (daydf['datetime'].dt.strftime('%H:%M') >= '09:16')]
            markettime['datetime'] = markettime['datetime'].apply(lambda x: x + datetime.timedelta(minutes=-1))
            if not premarket.empty:
                top1 = markettime.head(1)
                updatemarkettime = {'Open': premarket.head(1)['Open'].values[0],
                                    'High': max(top1.head(1)['High'].values[0], premarket['High'].max()),
                                    'Low': min(top1.head(1)['Low'].values[0], premarket['Low'].min()),
                                    'Volume': sum([top1.head(1)['Volume'].values[0], premarket['Volume'].sum()]),
                                    'OI': sum([top1.head(1)['OI'], premarket['OI'].sum()])
                                    }

                markettime.loc[top1.index[0], updatemarkettime.keys()] = updatemarkettime.values()

            # bifurcate days data into 15 mins
            u = (markettime.assign(timestamp=markettime['datetime'].dt.floor('20min'))
                 .groupby(pd.Grouper(key='datetime', freq='15min'))
                 .ngroup())
            markettime['15min_period'] = np.char.add('period_', (pd.factorize(u)[0] + 1).astype(str))

            grouped = markettime.groupby('15min_period')        # group by 15 mins data
            for i in markettime['15min_period'].unique():
                grp1 = grouped.get_group(i)
                mint = grp1.head(1)['datetime'].dt.strftime('%M').values[0]
                # round down minute  if not  15, 30, 45, 0
                if int(mint) not in [15, 30, 45, 0]:
                    if 14 >= int(mint):
                        grp1.head(1)['datetime'] = pd.Timestamp(grp1.head(1)['datetime'].values[0]).replace(minute=0)
                    elif 29 >= int(mint) >= 15:
                        grp1.head(1)['datetime'] = pd.Timestamp(grp1.head(1)['datetime'].values[0]).replace(minute=15)
                    elif 44 >= int(mint) >= 30:
                        grp1.head(1)['datetime'] = pd.Timestamp(grp1.head(1)['datetime'].values[0]).replace(minute=30)
                    elif 59 >= int(mint) >= 45:
                        grp1.head(1)['datetime'] = pd.Timestamp(grp1.head(1)['datetime'].values[0]).replace(minute=45)
                # store candle
                candle_of15 = {'Ticket': ticket[0], 'datetime': grp1.head(1)['datetime'].values[0],
                               'Open': grp1.head(1)['Open'].values[0], 'High': grp1['High'].max(),
                               'Low': grp1['Low'].min(), 'Close': grp1.tail(1)['Close'].values[0],
                               'Volume': grp1['Volume'].sum(), 'OI': grp1['OI'].sum()}
                base15minsdata.append(candle_of15)
            ticket[1].drop(list(daydf.index), inplace=True)

    base15minsdata = pd.DataFrame(base15minsdata)
    if excel:
        base15minsdata.to_excel(base15minsdata.head(1)['Ticket'].values[0]+'_15mins.xlsx', index=False)
    return base15minsdata


def apply_stopLoss(ordertyp, high, low, marketdf):
    """
    This function will apply stop loss
    :param ordertyp: if long or Short
    :param high: value of high
    :param low: value of low
    :param marketdf: dataframe of base market time
    :return:
    """
    if ordertyp == 'Long':
        checkslhit = marketdf[marketdf['Low'] <= low]
        if checkslhit.empty:
            return low, marketdf.tail(1)['Close'].values[0], marketdf.tail(1)['datetime'].dt.strftime('%H:%M').values[0]
        else:
            return low, low, marketdf.head(1)['datetime'].dt.strftime('%H:%M').values[0]
    else:
        checkslhit = marketdf[marketdf['High'] >= high]
        if checkslhit.empty:
            return high, marketdf.tail(1)['Close'].values[0], marketdf.tail(1)['datetime'].dt.strftime('%H:%M').values[0]
        else:
            return high, high, marketdf.head(1)['datetime'].dt.strftime('%H:%M').values[0]
    pass


def indices_filter(basedf, excel_out=True, excel_in=False, **kwargs):
    """
    this function will apply formula on indices data
    :param basedf: Dataframe with 15 minutes data or excel path
    :param excel_out:  Default True to generate excel output
    :param excel_in:  Default False will read data from excel
    :return: execl / Dataframe
    """
    index_output = list()
    if excel_in:
        basedf = pd.read_excel(basedf, engine='openpyxl')
    print('\n Number of rows', basedf.shape[0])
    tickets = basedf.groupby('Ticket')  # group data by Ticket name
    for ticket in tickets:
        workingdates = list(set(ticket[1]['datetime'].dt.date.tolist()))  # get all unique dates
        workingdates.sort()
        for date1 in tqdm(workingdates):
            # get data by date
            daydf = ticket[1][ticket[1]['datetime'].dt.date == date1]
            # data before 13:45 for day

            premarket = daydf[daydf['datetime'].dt.strftime('%H:%M') <= kwargs['premarket']]

            markettime = daydf[(daydf['datetime'].dt.strftime('%H:%M') <= '15:00') &
                               (daydf['datetime'].dt.strftime('%H:%M') > kwargs['premarket'])]

            # get High and low between 09:15 am to 13:45 pm
            high = premarket['High'].values.max()
            low = premarket['Low'].values.min()

            # get if high ot low is braked between 14:00 pm to 15:00
            chkhighbrk = markettime[markettime['High'] >= high]
            chklowbrk = markettime[markettime['Low'] <= low]

            # checking if high breaks and no data for low
            if not chkhighbrk.empty and chklowbrk.empty:
                if chkhighbrk.head(1)['datetime'].dt.strftime('%H:%M').values[0] == '15:00':
                    continue
                markettime = markettime[markettime['datetime'] > chkhighbrk.head(1)['datetime'].values[0]]
                # apply stop loss with buffer or not
                stoploss, exit_price, exittime = apply_stopLoss(
                    'Long', high, low - (low * kwargs['slbuffer']/100) if 'slbuffer' in kwargs else low, markettime)

                triggreddata = {'Ticket': ticket[0], 'Date': chkhighbrk.head(1)['datetime'].dt.date.values[0],
                                'Time': chkhighbrk.head(1)['datetime'].dt.strftime('%H:%M').values[0],
                                'OrderType': 'Long',
                                'Entry': high, 'StopLoss': stoploss,
                                'Exit': exit_price,
                                'Exit_Time': exittime}
                index_output.append(triggreddata)
                continue

            # checking if low breaks and no data for high
            elif not chklowbrk.empty and chkhighbrk.empty:
                if chklowbrk.head(1)['datetime'].dt.strftime('%H:%M').values[0] == '15:00':
                    continue
                markettime = markettime[markettime['datetime'] > chklowbrk.head(1)['datetime'].values[0]]
                # apply stop loss with buffer or not
                stoploss, exit_price, exittime = apply_stopLoss(
                    'Short', high, high + (high * kwargs['slbuffer'] / 100) if 'slbuffer' in kwargs else low, markettime)

                triggreddata = {'Ticket': ticket[0], 'Date': chklowbrk.head(1)['datetime'].dt.date.values[0],
                                'Time': chklowbrk.head(1)['datetime'].dt.strftime('%H:%M').values[0],
                                'OrderType': 'Short',
                                'Entry': low, 'StopLoss': stoploss,
                                'Exit': exit_price,
                                'Exit_Time': exittime}
                index_output.append(triggreddata)
                continue

            # checking if both high and low broke
            elif not chklowbrk.empty and not chkhighbrk.empty:
                # checking which triggered first high or low
                if chklowbrk.head(1)['datetime'].values[0] <= chkhighbrk.head(1)['datetime'].values[0]:
                    # low triggered first
                    if chklowbrk.head(1)['datetime'].dt.strftime('%H:%M').values[0] == '15:00':
                        continue
                    markettime = markettime[markettime['datetime'] > chklowbrk.head(1)['datetime'].values[0]]
                    # apply stop loss with buffer or not
                    stoploss, exit_price, exittime = apply_stopLoss(
                        'Short', high, high + (high * kwargs['slbuffer'] / 100) if 'slbuffer' in kwargs else low,
                        markettime)

                    triggreddata = {'Ticket': ticket[0], 'Date': chkhighbrk.head(1)['datetime'].dt.date.values[0],
                                    'Time': chklowbrk.head(1)['datetime'].dt.strftime('%H:%M').values[0],
                                    'OrderType': 'Short',
                                    'Entry': low, 'StopLoss': stoploss,
                                    'Exit': exit_price,
                                    'Exit_Time': exittime}
                    index_output.append(triggreddata)
                    continue

                else:
                    # high triggered first
                    if chkhighbrk.head(1)['datetime'].dt.strftime('%H:%M').values[0] == '15:00':
                        continue
                    markettime = markettime[markettime['datetime'] > chkhighbrk.head(1)['datetime'].values[0]]
                    # apply stop loss with buffer or not
                    stoploss, exit_price, exittime = apply_stopLoss(
                        'Long', high, low - (low * kwargs['slbuffer'] / 100) if 'slbuffer' in kwargs else low,
                        markettime)

                    triggreddata = {'Ticket': ticket[0], 'Date': chkhighbrk.head(1)['datetime'].dt.date.values[0],
                                    'Time': chkhighbrk.head(1)['datetime'].dt.strftime('%H:%M').values[0],
                                    'OrderType': 'Long',
                                    'Entry': high, 'StopLoss': stoploss,
                                    'Exit': exit_price,
                                    'Exit_Time': exittime}
                    index_output.append(triggreddata)
                    continue

            else:
                pass

    index_output = pd.DataFrame(index_output)
    if excel_out:
        index_output.to_excel(index_output.head(1)['Ticket'].values[0]+'_indexOutput.xlsx', index=False)


base15mins = generate_15mins_candle('indicesCopy/BankNiftyF1Data/2012_BankNifty_F1.txt')
indices_filter(base15mins, premarket='13:45')       # use parameter slbuffer=1 to add buffer stoploss buffer
