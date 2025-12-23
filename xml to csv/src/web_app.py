# Flask Web Application for XML to CSV Conversion

from flask import Flask, request, render_template, send_file
import os
from xml_to_csv import convert_xml_to_csv

app = Flask(__name__, template_folder='../templates')
UPLOAD_FOLDER = os.path.abspath(os.path.join(os.path.dirname(__file__), 'uploads'))
OUTPUT_FOLDER = os.path.abspath(os.path.join(os.path.dirname(__file__), 'outputs'))
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/convert', methods=['POST'])
def convert():
    if 'file' not in request.files:
        return "No file part"

    file = request.files['file']
    if file.filename == '':
        return "No selected file"

    input_path = os.path.join(UPLOAD_FOLDER, file.filename)
    output_path = os.path.join(OUTPUT_FOLDER, file.filename.replace('.xml', '.csv'))

    file.save(input_path)

    # Debugging logs
    print(f"Input path: {input_path}")
    print(f"Output path: {output_path}")

    # Check if input file was saved
    if not os.path.exists(input_path):
        return f"Error: Input file {input_path} was not saved."

    # Convert XML to CSV
    convert_xml_to_csv(input_path, output_path)

    # Check if output file was created
    if not os.path.exists(output_path):
        return f"Error: Output file {output_path} was not created."

    return send_file(output_path, as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True)
