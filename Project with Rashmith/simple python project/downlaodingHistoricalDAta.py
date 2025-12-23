import requests
from bs4 import BeautifulSoup

# Set the URL of the website you want to download data from
url = 'https://in.investing.com/indices/s-p-cnx-nifty-historical-data'

# Send a GET request to the website to download the data
response = requests.get(url)

# Check if the request was successful
if response.status_code == 200:
  # Use BeautifulSoup to parse the HTML response
  soup = BeautifulSoup(response.text, 'html.parser')
  
  # Find the table containing the historical data
  table = soup.find('table', {'id': 'curr_table'})
  
  # Iterate over the rows in the table
  for row in table.find_all('tr'):
    # Extract the data from each column in the row
    columns = row.find_all('td')
    date = columns[0].text
    open_price = columns[1].text
    high = columns[2].text
    low = columns[3].text
    close = columns[4].text
    volume = columns[5].text

    # Print the extracted data (or save it to a file, database, etc.)
    print(f'{date}: open={open_price}, high={high}, low={low}, close={close}, volume={volume}')
else:
  # Handle any errors that occurred during the request
  print(f'Error: {response.status_code}')


  print("hi")