# XML to CSV Conversion Logic

import xml.etree.ElementTree as ET
import pandas as pd
import os
import re

def convert_xml_to_csv(xml_file, output_csv):
    """
    Converts an XML file to a CSV file.

    Args:
        xml_file (str): Path to the input XML file.
        output_csv (str): Path to the output CSV file.
    """
    try:
        # Refined parsing logic to process <LogData> blocks as rows and their tags as columns
        data = []

        with open(xml_file, 'r', encoding='utf-8') as file:
            content = file.read()

        # Extract <LogData> blocks using regex
        logdata_pattern = re.compile(r'<LogData.*?</LogData>', re.DOTALL)
        logdata_blocks = logdata_pattern.findall(content)

        for block in logdata_blocks:
            try:
                root = ET.fromstring(block)
                row = {}
                for child in root:
                    row[child.tag] = child.text.strip() if child.text else ''
                data.append(row)
            except ET.ParseError as e:
                print(f"Warning: Skipping malformed <LogData> block - {e}")

        # Convert to DataFrame and save as CSV
        if data:
            df = pd.DataFrame(data)
            df.to_csv(output_csv, index=False)
            print(f"Successfully converted {xml_file} to {output_csv}.")
        else:
            print(f"No valid <LogData> blocks found in {xml_file}.")
    except Exception as e:
        print(f"Error: {e}")
