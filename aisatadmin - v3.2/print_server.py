from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import sys
from datetime import datetime

# Import the printer module
try:
    from possy import PosSys, print_test_receipt
    THERMAL_PRINTING_AVAILABLE = True
except ImportError as e:
    THERMAL_PRINTING_AVAILABLE = False
    print(f"possy.py not available - thermal printing will be disabled: {e}")

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

@app.route('/api/printer/status', methods=['GET'])
def printer_status():
    """Return the printer status"""
    return jsonify({
        'available': THERMAL_PRINTING_AVAILABLE,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/printer/test', methods=['GET'])
def test_printer():
    """Test the printer by printing a sample receipt"""
    if not THERMAL_PRINTING_AVAILABLE:
        return jsonify({'success': False, 'message': 'Thermal printing is not available'})
        
    try:
        test_text = """
AISAT CARES - TEST RECEIPT
==========================

This is a test receipt
to verify the thermal 
printer is working properly.

==========================
Test completed successfully!

"""
        printer = PosSys(test_text)
        result = printer.print_receipt()
        return jsonify({
            'success': result,
            'message': 'Test receipt sent to printer' if result else 'Failed to print test receipt'
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error testing printer: {str(e)}'})

@app.route('/api/printer/print', methods=['POST'])
def print_receipt():
    """Print a receipt with the provided data"""
    if not THERMAL_PRINTING_AVAILABLE:
        return jsonify({'success': False, 'message': 'Thermal printing is not available'})
        
    try:
        receipt_data = request.json
        
        if not receipt_data:
            return jsonify({'success': False, 'message': 'No receipt data provided'})
        
        # Format the receipt text
        text = format_receipt_text(receipt_data)
        
        # Print using PosSys
        printer = PosSys(text)
        result = printer.print_receipt()
        return jsonify({
            'success': result,
            'message': 'Receipt printed successfully' if result else 'Failed to print receipt'
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'Error printing receipt: {str(e)}'})

def format_receipt_text(receipt_data):
    """Format the receipt text for printing"""
    # Get current date/time for receipt
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Build the receipt text
    text = "AISAT CARES\n"
    text += "Request Receipt\n"
    text += f"Date: {now}\n"
    text += "===============================\n\n"
    
    # Request details
    text += f"Request ID: {receipt_data.get('requestId', '')}\n"
    text += f"Student ID: {receipt_data.get('studentId', '')}\n"
    text += f"Name: {receipt_data.get('studentName', '')}\n"
    text += f"Date: {receipt_data.get('date', '')}\n"
    text += f"Time: {receipt_data.get('time', '')}\n"
    text += f"Level: {receipt_data.get('level', '')}\n"
    text += f"Payment Type: {receipt_data.get('paymentType', '')}\n"
    text += f"Payment Method: {receipt_data.get('paymentMethod', '')}\n"
    
    text += "===============================\n\n"
    text += "Thank you for using AISAT CARES!\n"
    text += "Please keep this receipt.\n\n\n"
    
    return text

if __name__ == '__main__':
    # Default port is 5000, but allow command line override
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5000
    
    # Notify that the server is starting
    print(f"Starting printer server on port {port}")
    print(f"Thermal printing available: {THERMAL_PRINTING_AVAILABLE}")
    
    # Run the Flask app
    app.run(host='127.0.0.1', port=port, debug=False) 