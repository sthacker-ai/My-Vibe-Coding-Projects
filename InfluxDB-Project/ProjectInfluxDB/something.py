import sys
#print(f"Script using Python at: {sys.executable}")
#print(f"Script looking for packages in: {sys.path}")

import csv
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS
from datetime import datetime

# InfluxDB connection details
url = "http://localhost:8086"
token = "UJDp9zFxjqqiGRGMvHJnSKsWWx12MHan1e3U8m5RDNqzn3FqCkRPiuCrqNa2HM8PW7mRKdMAFypspzGc0gL94A=="
org = "StockAnalyzer"
bucket = "NewNifty50"

# Initialize InfluxDB client
client = InfluxDBClient(url=url, token=token)
write_api = client.write_api(write_options=SYNCHRONOUS)

def write_csv_to_influxdb(csv_file_path):
    with open(csv_file_path, mode='r') as file:
        csv_reader = csv.reader(file)
        
        for row in csv_reader:
            if len(row) < 9:  # Skip rows with insufficient data
                print(f"Skipping row (insufficient data): {row}")
                continue
                
            try:
                # Parse all columns from the CSV
                symbol = row[0]
                date_str = row[1]
                time_str = row[2]
                open_price = float(row[3])
                high_price = float(row[4])
                low_price = float(row[5])
                close_price = float(row[6])
                volume = int(row[7]) if row[7] and row[7] != '0' else 0
                volume_futures = int(row[8]) if len(row) > 8 and row[8] and row[8] != '0' else 0
                
                # Create timestamp from date and time
                timestamp_str = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:]} {time_str}"
                timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M")
                
                # Create a single point with all fields
                point = Point(symbol)  # Use symbol as the measurement name
                # Use date as a tag for easier filtering
                point = point.tag("date", date_str)
                # Store all values as fields
                point = point.field("open", open_price)
                point = point.field("high", high_price)
                point = point.field("low", low_price)
                point = point.field("close", close_price)
                point = point.field("volume", volume)
                point = point.field("volume_futures", volume_futures)
                point = point.time(timestamp, WritePrecision.NS)
                
                # Write to InfluxDB
                write_api.write(bucket=bucket, org=org, record=point)
                print(f"Wrote point: {symbol} @ {timestamp}")
                
            except Exception as e:
                print(f"Error processing row {row}: {e}")
                
if __name__ == "__main__":
    csv_file_path = "G:/My Drive/StockMarket/InfluxDB-Project/ProjectInfluxDB/2020_Nifty_Spot-new.csv"
    write_csv_to_influxdb(csv_file_path)
    print("CSV data has been written to InfluxDB")