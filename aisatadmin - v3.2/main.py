import sys
import os
import requests
import json
import threading
import subprocess
import time
from PyQt5.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                            QHBoxLayout, QPushButton, QLabel, QFrame, QSizePolicy,
                            QMessageBox, QStackedWidget, QDialog, QLineEdit, 
                            QFormLayout, QDialogButtonBox, QCheckBox, QSlider)
from PyQt5.QtCore import Qt, QSettings, QUrl, PYQT_VERSION_STR, QObject, pyqtSignal, QTimer
from PyQt5.QtGui import QFont, QIcon, QPixmap
from datetime import datetime, timedelta

# Start the printer server in a separate thread
print_server_process = None

def start_print_server():
    """Start the Flask print server in a separate process"""
    global print_server_process
    
    # Define the path to the print_server.py file
    print_server_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "print_server.py")
    
    if not os.path.exists(print_server_path):
        print(f"Warning: Print server script not found at {print_server_path}")
        return
    
    print("Starting print server...")
    
    # Check if any process is using port 5000 and kill it
    try:
        import socket
        test_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        test_result = test_socket.connect_ex(('127.0.0.1', 5000))
        test_socket.close()
        
        if test_result == 0:  # Port is in use
            print("Port 5000 is in use. Trying to free it...")
            if sys.platform == 'win32':
                os.system('netstat -ano | findstr :5000')
                os.system('for /f "tokens=5" %a in (\'netstat -ano ^| findstr :5000\') do taskkill /f /pid %a')
            else:
                os.system("lsof -i:5000 | awk 'NR!=1 {print $2}' | xargs kill -9 2>/dev/null || true")
    except Exception as e:
        print(f"Error checking/freeing port: {e}")
    
    # Start the print server as a subprocess
    print_server_process = subprocess.Popen(
        [sys.executable, print_server_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True
    )
    
    # Check if the process started successfully
    time.sleep(1)
    if print_server_process.poll() is not None:
        stdout, stderr = print_server_process.communicate()
        print(f"Failed to start print server: {stderr}")
        return
    
    print("Print server started successfully")
    
    # Start a thread to monitor print server output
    def monitor_output():
        if print_server_process and print_server_process.stdout:
            for line in print_server_process.stdout:
                print(f"Print Server: {line.strip()}")
    
    output_thread = threading.Thread(target=monitor_output, daemon=True)
    output_thread.start()

# Start the print server when the module is imported
start_print_server()

# Register an atexit handler to ensure the print server is terminated when main.py exits
import atexit
def cleanup_print_server():
    global print_server_process
    if print_server_process and print_server_process.poll() is None:
        print("Terminating print server...")
        print_server_process.terminate()
        try:
            print_server_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            print("Print server didn't terminate gracefully, forcing...")
            print_server_process.kill()

atexit.register(cleanup_print_server)

# QWebEngineView is required for this functionality.
# If you don't have it, please install it: pip install PyQtWebEngine
from PyQt5.QtWebEngineWidgets import QWebEngineView

# Import the possy module for thermal printing
try:
    from possy import PosSys
    THERMAL_PRINTING_AVAILABLE = True
    print("Thermal printing (possy.py) is available")
except ImportError as e:
    # Set to True since we're using the Flask API for printing
    THERMAL_PRINTING_AVAILABLE = True
    print(f"Using Flask printer server instead of direct thermal printing")

# API base URL - this should match the server.py port
API_BASE_URL = "https://jimboyaczon.pythonanywhere.com"

# Define QWIDGETSIZE_MAX (same as in Qt)
QWIDGETSIZE_MAX = 16777215

# Theme colors - matching the HTML files in sideload directory
THEME_COLORS = {
    "light": {
        "bg_primary": "#f8f9fa",
        "bg_secondary": "#ffffff",
        "text_primary": "#2d2a2e",
        "text_secondary": "#5a5a5a",
        "accent_color": "#3498db",
        "accent_hover": "#2980b9",
        "border_color": "#e9ecef",
        "shadow_color": "rgba(0,0,0,0.05)",
        "sidebar_bg": "#2c3e50",
        "sidebar_text": "#ffffff",  # White text for sidebar
        "sidebar_hover": "#34495e",
        "sidebar_active": "#2980b9"
    },
    "dark": {
        "bg_primary": "#2d2a2e",
        "bg_secondary": "#3b3842",
        "text_primary": "#fcfcfa",
        "text_secondary": "#c1c0c0",
        "accent_color": "#78dce8",
        "accent_hover": "#5fb9c5",
        "border_color": "#4a474e",
        "shadow_color": "rgba(0,0,0,0.2)",
        "sidebar_bg": "#1e1e1e",
        "sidebar_text": "#fcfcfa",  # Light text for sidebar
        "sidebar_hover": "#2d2d2d",
        "sidebar_active": "#5fb9c5"
    }
}

# Global variable to store receipt data from JavaScript
PENDING_RECEIPT_DATA = None

# Direct test function to print a test receipt
def test_thermal_printer():
    if THERMAL_PRINTING_AVAILABLE:
        try:
            print("Testing thermal printer...")
            # Use the Flask API to test the printer
            import requests
            response = requests.get("http://localhost:5000/api/printer/test")
            result = response.json().get('success', False)
            print(f"Test result: {'Success' if result else 'Failed'}")
            return result
        except Exception as e:
            print(f"Error during printer test: {e}")
            return False
    else:
        print("Thermal printing is not available")
        return False
        
# Function to print receipt with data from JavaScript
def print_receipt_with_data(receipt_data):
    if not THERMAL_PRINTING_AVAILABLE:
        print("ERROR: Thermal printing not available")
        return False
        
    try:
        print(f"Sending receipt to Flask API for {receipt_data.get('studentName', 'Unknown')}")
        
        # Use the Flask API to print the receipt
        import requests
        response = requests.post(
            "http://localhost:5000/api/printer/print", 
            json=receipt_data,
            headers={"Content-Type": "application/json"}
        )
        
        result = response.json().get('success', False)
        print(f"Print result from API: {result}")
        return result
    except Exception as e:
        print(f"ERROR printing receipt: {e}")
        return False
        
# Note: Format receipt text function moved to print_server.py

class WebEngineView(QWebEngineView):
    """A custom web view to handle token injection for authenticated sessions."""
    
    def __init__(self, token, initial_js_call=None, theme=None):
        super(WebEngineView, self).__init__()
        self.token = token
        self.initial_js_call = initial_js_call
        self.theme = theme
        
        # When the page finishes loading, inject the token and API base URL
        self.loadFinished.connect(self._on_load_finished)
        
        # Set up URL handler for PDF export
        self.page().profile().downloadRequested.connect(self.handle_download)
        self.urlChanged.connect(self.handle_url_changed)
        
        # Timer to check for pending receipts
        self.receipt_timer = QTimer()
        self.receipt_timer.setInterval(500)  # Check every 500ms
        self.receipt_timer.timeout.connect(self.check_pending_receipts)
        self.receipt_timer.start()
    
    def check_pending_receipts(self):
        """Check and process any pending receipt data"""
        global PENDING_RECEIPT_DATA
        if PENDING_RECEIPT_DATA:
            print("Found pending receipt data, printing...")
            receipt_data = PENDING_RECEIPT_DATA
            PENDING_RECEIPT_DATA = None  # Clear it
            success = print_receipt_with_data(receipt_data)
            print(f"Print result: {'Success' if success else 'Failed'}")
    
    def handle_url_changed(self, url):
        """Handle custom URL schemes"""
        url_string = url.toString()
        print(f"URL changed: {url_string}")
        
        if url_string.startswith("pyqt://print_receipt"):
            # Extract receipt data from the URL parameters
            try:
                print("Detected print_receipt URL scheme")
                from urllib.parse import urlparse, parse_qs, unquote
                parsed_url = urlparse(url_string)
                query_params = parse_qs(parsed_url.query)
                
                if 'data' in query_params:
                    data_json = unquote(query_params['data'][0])
                    print(f"Extracted receipt data (length: {len(data_json)})")
                    
                    # Parse the JSON data
                    try:
                        receipt_data = json.loads(data_json)
                        print(f"Successfully parsed receipt JSON data: {receipt_data.get('requestId', 'unknown ID')}")
                        
                        # Store globally for processing
                        global PENDING_RECEIPT_DATA
                        PENDING_RECEIPT_DATA = receipt_data
                        print("Receipt data stored for printing")
                        
                        # Try to print immediately too
                        print("Attempting immediate print...")
                        success = print_receipt_with_data(receipt_data)
                        print(f"Immediate print result: {'Success' if success else 'Failed'}")
                        
                        return True
                    except json.JSONDecodeError as e:
                        print(f"Error decoding receipt JSON: {e}")
                        return False
                else:
                    print("No data parameter found in URL")
                    return False
            except Exception as e:
                print(f"Error processing print_receipt URL: {e}")
                return False
             
        elif url_string.startswith("pyqt://test_printer"):
            # Test the printer directly
            return test_thermal_printer()
            
        elif url_string.startswith("pyqt://export_pdf"):
            # This will be handled by the form submission
            print("PDF export URL detected")
            
        return False
    
    def handle_download(self, download):
        """Handle file downloads"""
        print(f"Download requested: {download.url().toString()}")
        download.accept()
    
    def createWindow(self, type_):
        """Create a new window for form submissions"""
        # For different PyQt versions, the tab type might be different
        # Let's check if it's a new window/tab request and handle it
        if type_ == 1:  # 1 is typically WebBrowserTab in most PyQt versions
            # Create a temporary view to handle the form submission
            temp_view = QWebEngineView(self)
            temp_view.urlChanged.connect(lambda url: self.handle_form_submission(url, temp_view))
            return temp_view
        return None
    
    def handle_form_submission(self, url, view):
        """Handle form submissions to our custom URL scheme"""
        url_string = url.toString()
        if url_string.startswith("pyqt://export_pdf"):
            # Get the form data
            view.page().toHtml(lambda html: self.process_pdf_export(html, view))
            return True
        return False
    
    def process_pdf_export(self, html, view):
        """Process the PDF export request"""
        try:
            # Extract the export_data from the HTML
            import re
            from PyQt5.QtPrintSupport import QPrinter
            import json
            import os
            
            # Extract the JSON data from the form
            match = re.search(r'name="export_data" value="([^"]+)"', html)
            if match:
                # Decode the JSON data (need to handle escaped quotes)
                json_str = match.group(1).replace('&quot;', '"')
                export_data = json.loads(json_str)
                
                # Get the Downloads folder path
                downloads_path = os.path.join(os.path.expanduser('~'), 'Downloads')
                if not os.path.exists(downloads_path):
                    # If Downloads folder doesn't exist, create it or use Desktop
                    if os.path.exists(os.path.join(os.path.expanduser('~'), 'Desktop')):
                        downloads_path = os.path.join(os.path.expanduser('~'), 'Desktop')
                    else:
                        downloads_path = os.path.expanduser('~')  # Fallback to user directory
                
                # Generate a unique filename using timestamp
                from datetime import datetime
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = export_data.get('path', f'AISAT_Transaction_History_{timestamp}.pdf')
                file_path = os.path.join(downloads_path, filename)
                
                # If a file with the same name already exists, add a number to make it unique
                base_name = os.path.splitext(file_path)[0]
                extension = os.path.splitext(file_path)[1]
                counter = 1
                while os.path.exists(file_path):
                    file_path = f"{base_name}_{counter}{extension}"
                    counter += 1
                
                # Create a printer object
                printer = QPrinter(QPrinter.HighResolution)
                printer.setOutputFormat(QPrinter.PdfFormat)
                printer.setOutputFileName(file_path)
                
                # Create a new WebEngineView to render the PDF content
                from PyQt5.QtCore import QSize
                pdf_view = QWebEngineView()
                pdf_view.resize(QSize(1024, 768))  # Set a reasonable size
                
                # Generate HTML content for the PDF
                html_content = self.generate_pdf_html(export_data)
                pdf_view.setHtml(html_content)
                
                # When the page is loaded, print it to PDF
                pdf_view.loadFinished.connect(
                    lambda ok: self.print_to_pdf(ok, pdf_view, printer, file_path)
                )
                
                # Clean up the temporary view
                view.deleteLater()
            else:
                print("Could not extract export data from form submission")
                view.deleteLater()
        except Exception as e:
            print(f"Error processing PDF export: {e}")
            view.deleteLater()
    
    def print_to_pdf(self, ok, view, printer, file_path):
        """Print the view to PDF"""
        if ok:
            def pdf_done(success):
                if success:
                    print(f"PDF saved successfully to {file_path}")
                    # Get the folder name for a cleaner message
                    import os
                    folder_name = os.path.dirname(file_path)
                    file_name = os.path.basename(file_path)
                    
                    # Check if it's in Downloads or Desktop folder
                    if "Downloads" in folder_name:
                        folder_display = "Downloads folder"
                    elif "Desktop" in folder_name:
                        folder_display = "Desktop"
                    else:
                        folder_display = folder_name
                        
                    QMessageBox.information(
                        self, 
                        "PDF Export", 
                        f"PDF report '{file_name}' has been saved to your {folder_display}."
                    )
                else:
                    print("PDF printing failed")
                    QMessageBox.warning(
                        self, 
                        "PDF Export Failed", 
                        "Failed to generate the PDF report."
                    )
                view.deleteLater()
            
            # Print to PDF
            view.page().printToPdf(file_path, printer.pageLayout())
            view.page().pdfPrintingFinished.connect(pdf_done)
        else:
            print("Page loading failed")
            view.deleteLater()
    
    def generate_pdf_html(self, export_data):
        """Generate HTML content for the PDF"""
        title = export_data.get('title', 'Transaction History')
        filters = export_data.get('filters', {})
        stats = export_data.get('stats', '')
        transactions = export_data.get('transactions', [])
        
        # Format date filters
        date_from = filters.get('dateFrom', '')
        date_to = filters.get('dateTo', '')
        status = filters.get('status', '')
        payment_type = filters.get('paymentType', '')
        
        # Generate HTML
        html = f"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>{title}</title>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                    color: #333;
                }}
                .header {{
                    text-align: center;
                    margin-bottom: 30px;
                }}
                .header h1 {{
                    color: #001489;
                    margin-bottom: 10px;
                }}
                .header p {{
                    margin: 5px 0;
                    color: #666;
                }}
                .filter-info {{
                    margin: 20px 0;
                    padding: 10px;
                    background-color: #f8f9fa;
                    border: 1px solid #e9ecef;
                    border-radius: 4px;
                }}
                table {{
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 30px;
                }}
                th, td {{
                    padding: 10px;
                    text-align: left;
                    border: 1px solid #ddd;
                }}
                th {{
                    background-color: #001489;
                    color: white;
                }}
                tr:nth-child(even) {{
                    background-color: #f2f2f2;
                }}
                tr.approved {{
                    background-color: #def7ec;
                }}
                tr.rejected {{
                    background-color: #fde8e8;
                }}
                .stats-section {{
                    margin-bottom: 30px;
                }}
                .stats-section h2 {{
                    color: #001489;
                    border-bottom: 1px solid #ddd;
                    padding-bottom: 10px;
                }}
                .footer {{
                    margin-top: 50px;
                    text-align: center;
                    font-size: 12px;
                    color: #666;
                }}
            </style>
        </head>
        <body>
            <div class="header">
                <h1>{title}</h1>
                <p>Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
            </div>
            
            <div class="filter-info">
                <strong>Filters Applied:</strong>
                {f"<p>From Date: {date_from}</p>" if date_from else ""}
                {f"<p>To Date: {date_to}</p>" if date_to else ""}
                {f"<p>Status: {status}</p>" if status else ""}
                {f"<p>Payment Type: {payment_type}</p>" if payment_type else ""}
                {f"<p>No filters applied</p>" if not any([date_from, date_to, status, payment_type]) else ""}
            </div>
            
            <div class="stats-section">
                <h2>Statistics</h2>
                {stats}
            </div>
            
            <h2>Transaction List</h2>
            <table>
                <thead>
                    <tr>
                        <th>Date/Time</th>
                        <th>Request ID</th>
                        <th>ID Number</th>
                        <th>Name</th>
                        <th>Level</th>
                        <th>Payment</th>
                        <th>Status</th>
                        <th>Processed By</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
        """
        
        # Add transaction rows
        if transactions:
            for trans in transactions:
                # Format date nicely
                formatted_date = 'N/A'
                if trans.get('action_date'):
                    try:
                        date = datetime.fromisoformat(trans['action_date'].replace('Z', '+00:00'))
                        formatted_date = date.strftime('%Y-%m-%d %H:%M:%S')
                    except:
                        formatted_date = trans['action_date']
                
                status_class = trans.get('status', '')
                html += f"""
                    <tr class="{status_class}">
                        <td>{formatted_date}</td>
                        <td>{trans.get('request_id', '')}</td>
                        <td>{trans.get('idno', '')}</td>
                        <td>{trans.get('name', '')}</td>
                        <td>{trans.get('level', '')}</td>
                        <td>{trans.get('payment', '')}</td>
                        <td>{trans.get('status', '')}</td>
                        <td>{trans.get('admin_name', '')}</td>
                        <td>{trans.get('notes', '')}</td>
                    </tr>
                """
        else:
            html += """
                <tr>
                    <td colspan="9" style="text-align: center;">No transactions found</td>
                </tr>
            """
        
        # Close the HTML
        html += f"""
                </tbody>
            </table>
            
            <div class="footer">
                <p>AISAT College Registral Services</p>
                <p>This report contains {len(transactions) if transactions else 0} transactions</p>
            </div>
        </body>
        </html>
        """
        
        return html

    def _on_load_finished(self, ok):
        if ok:
            # This JavaScript code runs inside the loaded web page.
            # It sets the userToken and baseUrl in localStorage to allow API calls
            js_code = f"""
            console.log('Injecting token into page...');
            localStorage.setItem('userToken', '{self.token}');
            localStorage.setItem('baseUrl', 'https://jimboyaczon.pythonanywhere.com');
            
            // Add receipt printing function that uses URL scheme for communication
            console.log('Setting up thermal receipt printing');
            
            // Override the printer functions from printer.js
            console.log('Initializing thermal printer functions in PyQt...');
            
            // Update printer availability flag
            window.thermalPrinterAvailable = {THERMAL_PRINTING_AVAILABLE};
            console.log('Thermal printer available:', window.thermalPrinterAvailable);
            
            // Function to test the printer
            window.testThermalPrinter = function() {{
                console.log('Testing thermal printer...');
                const testFrame = document.createElement('iframe');
                testFrame.style.display = 'none';
                testFrame.src = 'pyqt://test_printer';
                document.body.appendChild(testFrame);
                
                return new Promise((resolve) => {{
                    setTimeout(() => {{
                        document.body.removeChild(testFrame);
                        console.log('Test printer request sent');
                        resolve(true);
                    }}, 500);
                }});
            }};
            
            // Create a function for thermal printing that communicates via URL scheme
            window.printThermalReceipt = function(receiptData) {{
                // Ignore test calls from isPrinterInitialized
                if (receiptData && receiptData.test === true) {{
                    console.log('Received test call - printer is initialized');
                    return Promise.resolve(true);
                }}
                
                console.log('printThermalReceipt function is now available');
                return new Promise((resolve, reject) => {{
                    try {{
                        console.log('printThermalReceipt called with data:', receiptData);
                            
                            // Convert receipt data to JSON and encode for URL
                            const jsonData = JSON.stringify(receiptData);
                            const encodedData = encodeURIComponent(jsonData);
                            console.log('Data encoded, length: ' + encodedData.length);
                            
                            // Create a hidden iframe to trigger the custom URL scheme
                            const printFrame = document.createElement('iframe');
                            printFrame.style.display = 'none';
                            printFrame.src = 'pyqt://print_receipt?data=' + encodedData;
                            console.log('Created iframe with URL scheme');
                            
                            // Add to document, then remove after a short delay
                            document.body.appendChild(printFrame);
                            console.log('Added iframe to document');
                            
                            // Set a timeout to resolve the promise
                            setTimeout(() => {{
                                document.body.removeChild(printFrame);
                                console.log('Print request completed');
                                resolve(true);
                            }}, 1000);
                        }} catch (error) {{
                            console.error('Error sending receipt data:', error);
                            reject(error);
                        }}
                    }});
                }};
                
                // Add a test button to manually test the printer
                setTimeout(() => {{
                    // Only add test button on request.html page
                    if (!window.location.href.includes('request.html')) {{
                        console.log('Not on request.html page, skipping test button');
                        return;
                    }}
                    console.log('On request.html page, adding test button');
                    
                    // Find a good place to add the button - near the print button
                    const printBtn = document.getElementById('print-receipt-btn');
                    if (printBtn && !document.getElementById('test-printer-btn')) {{
                        const testBtn = document.createElement('button');
                        testBtn.id = 'test-printer-btn';
                        testBtn.innerHTML = '<i class="fas fa-print"></i> Test Printer';
                        testBtn.style.marginTop = '10px';
                        testBtn.onclick = function() {{
                            // Create hidden iframe with test URL
                            const testFrame = document.createElement('iframe');
                            testFrame.style.display = 'none';
                            testFrame.src = 'pyqt://test_printer';
                            document.body.appendChild(testFrame);
                            
                            setTimeout(() => {{
                                document.body.removeChild(testFrame);
                                alert('Printer test initiated. Check the printer for output.');
                            }}, 500);
                        }};
                        
                        // Add it after the print button
                        printBtn.parentNode.appendChild(document.createElement('br'));
                        printBtn.parentNode.appendChild(testBtn);
                    }}
                }}, 2000);
                
                // Signal that the token is available
                console.log(JSON.stringify({{
                    type: 'authEvent',
                    event: 'tokenSet',
                    token: '{self.token}'
                }}));
            """
            
            # Set theme if provided
            if self.theme:
                js_code += f"localStorage.setItem('adminTheme', '{self.theme}'); document.documentElement.setAttribute('data-theme', '{self.theme}');"
            
            # Use a callback to ensure the token is set before making any API calls
            def token_set_callback(result):
                if self.initial_js_call:
                    self.page().runJavaScript(f"{self.initial_js_call}();")
            
            self.page().runJavaScript(js_code, token_set_callback)
            
            # Apply syntax highlighting to code blocks if any
            highlight_js = """
            if(typeof hljs !== 'undefined') {
                document.querySelectorAll('pre code').forEach((el) => {
                    hljs.highlightElement(el);
                });
            }
            """
            self.page().runJavaScript(highlight_js)
            
            # Let the page know that printer initialization is complete
            if THERMAL_PRINTING_AVAILABLE:
                printer_ready_js = """
                if (typeof document.dispatchEvent === 'function') {
                    console.log('Notifying page that printer is ready');
                    document.dispatchEvent(new CustomEvent('printerReady'));
                } else {
                    console.error('Cannot dispatch printer ready event');
                }
                """
                self.page().runJavaScript(printer_ready_js)
        else:
            print("Page did not load successfully")
    
    def update_theme(self, theme):
        """Update the theme of the web view."""
        self.theme = theme
        js_code = f"localStorage.setItem('adminTheme', '{theme}'); document.documentElement.setAttribute('data-theme', '{theme}');"
        self.page().runJavaScript(js_code)

class AddUserDialog(QDialog):
    """A dialog for admins to create a new user."""
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Add New User")

        # Create input widgets
        self.idno_input = QLineEdit()
        self.name_input = QLineEdit()
        self.email_input = QLineEdit()
        self.level_options = ["College", "SHS"]
        self.level_input = QLineEdit()
        self.level_input.setText(self.level_options[0])  # Default to College
        self.cell_input = QLineEdit()
        self.password_input = QLineEdit()
        self.password_input.setEchoMode(QLineEdit.Password)

        # Layout the form
        form_layout = QFormLayout()
        form_layout.addRow("ID Number:", self.idno_input)
        form_layout.addRow("Full Name:", self.name_input)
        form_layout.addRow("Email:", self.email_input)
        form_layout.addRow("Level (College/SHS):", self.level_input)
        form_layout.addRow("Contact Number:", self.cell_input)
        form_layout.addRow("Password:", self.password_input)

        # Create OK and Cancel buttons
        button_box = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        button_box.accepted.connect(self.accept)
        button_box.rejected.connect(self.reject)

        main_layout = QVBoxLayout()
        main_layout.addLayout(form_layout)
        main_layout.addWidget(button_box)
        self.setLayout(main_layout)

    def get_data(self):
        """Returns the data entered in the form as a dictionary."""
        return {
            "idno": self.idno_input.text(),
            "name": self.name_input.text(),
            "email": self.email_input.text(),
            "level": self.level_input.text(),
            "cell": self.cell_input.text(),
            "password": self.password_input.text(),
        }

class ThemeSwitch(QWidget):
    """A custom widget for theme switching."""
    def __init__(self, admin_panel=None):
        super(ThemeSwitch, self).__init__()
        self.is_dark = False
        self.admin_panel = admin_panel
        
        # Main layout
        layout = QHBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(5)
        
        # Toggle switch
        self.switch = QCheckBox()
        self.switch.setStyleSheet("""
            QCheckBox {
                background-color: transparent;
            }
            QCheckBox::indicator {
                width: 36px;
                height: 18px;
                border-radius: 9px;
                background-color: #3b3842;
            }
            QCheckBox::indicator:checked {
                background-color: #78dce8;
            }
            QCheckBox::indicator:unchecked {
                background-color: #3498db;
            }
        """)
        
        # Theme label
        self.theme_label = QLabel("Light")
        self.theme_label.setStyleSheet("color: white; font-size: 14px;")
        
        # Add widgets to layout
        layout.addWidget(self.switch)
        layout.addWidget(self.theme_label)
        
        # Connect signal
        self.switch.stateChanged.connect(self.on_state_changed)
        
    def on_state_changed(self, state):
        self.is_dark = (state == Qt.CheckState.Checked)
        if self.admin_panel:
            self.admin_panel.on_theme_changed(self.is_dark)
        
        # Update label
        self.theme_label.setText("            Dark" if self.is_dark else "            Light")
        
    def set_theme(self, is_dark):
        self.is_dark = is_dark
        self.switch.setChecked(is_dark)
        self.theme_label.setText("            Dark" if is_dark else "            Light")

# Function to check if a session token is valid
def check_session(settings):
    """Check if the current session token is valid"""
    token = settings.value("auth_token", "")
    
    if not token:
        return False, None, None
    
    try:
        response = requests.get(
            f"{API_BASE_URL}/api/auth/verify",
            headers={"Authorization": f"Bearer {token}"},
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            if data.get("valid") and data.get("is_admin"):
                return True, data.get("name", "Admin"), data.get("id")
        
        settings.remove("auth_token")
        return False, None, None
    
    except requests.exceptions.RequestException:
        # If the server is unreachable, use cached admin name if available
        cached_name = settings.value("admin_name", "Admin")
        cached_id = settings.value("admin_id")
        return True, cached_name, cached_id  # Trust the token when server is unreachable 

class AuthWebView(QWebEngineView):
    """A specialized WebEngineView for handling authentication via auth.html"""
    def __init__(self, parent=None):
        super(AuthWebView, self).__init__()
        self._parent = parent  # Use _parent to avoid shadowing the parent() method
        
        # Make sure we're fully initialized before proceeding
        self.initialized = False
        
        # Load the auth page
        auth_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "auth.html")
        
        if os.path.exists(auth_path):
            # Connect to loadFinished before setting URL
            self.loadFinished.connect(self._on_load_finished)
            # Load the page
            self.setUrl(QUrl.fromLocalFile(auth_path))
        else:
            print(f"ERROR: auth.html not found at {auth_path}")
            if self._parent:
                QMessageBox.critical(self._parent, "Error", f"Could not find authentication file at {auth_path}")
    
    def _on_load_finished(self, ok):
        """Handle page load completion"""
        if ok:
            print("Auth page loaded successfully")
            # Mark as initialized
            self.initialized = True
            # Install auth handlers
            js_code = """
            // Initialize console logger
            console.log('Auth view initialized');
            
            // Override localStorage to detect when token is set
            const originalSetItem = localStorage.setItem;
            localStorage.setItem = function(key, value) {
                originalSetItem.call(this, key, value);
                
                // Log token changes for PyQt to detect
                if (key === 'userToken') {
                    console.log(JSON.stringify({
                        type: 'authEvent', 
                        event: 'tokenSet',
                        token: value
                    }));
                }
                
                // Log admin name changes
                if (key === 'adminName') {
                    console.log(JSON.stringify({
                        type: 'authEvent',
                        event: 'adminNameSet',
                        name: value
                    }));
                }
                
                // Log theme changes
                if (key === 'adminTheme' || key === 'authTheme') {
                    console.log(JSON.stringify({
                        type: 'authEvent',
                        event: 'themeSet',
                        theme: value
                    }));
                }
            };
            console.log('Authentication handlers installed');
            """
            
            self.page().runJavaScript(js_code)
        else:
            print("Auth page failed to load")
    
    # Custom handler for console messages
    def javaScriptConsoleMessage(self, level, message, lineNumber, sourceID):
        """Handle messages from the console in the WebView"""
        # Print all console messages for debugging
        print(f"Auth Console: [{level}] {message} (at line {lineNumber} in {sourceID})")
        
        # Check for structured messages like {type: 'authEvent'}
        if '{' in message and '}' in message:
            try:
                # Try to extract JSON-like object from console message
                import re
                import json
                
                json_match = re.search(r'\{.+\}', message)
                if json_match:
                    data = json.loads(json_match.group(0).replace("'", '"'))
                    msg_type = data.get('type')
                    
                    # Handle authentication events
                    if msg_type == 'authEvent':
                        event = data.get('event')
                        
                        if event == 'tokenSet':
                            token = data.get('token')
                            print(f"Auth token captured: {token[:10]}...")
                            # Store the token in settings
                            if self._parent and hasattr(self._parent, 'settings'):
                                self._parent.settings.setValue("auth_token", token)
                                # Trigger authentication completion
                                self._parent.on_authentication_complete(token)
                        
                        elif event == 'adminNameSet':
                            name = data.get('name')
                            print(f"Admin name captured: {name}")
                            if self._parent and hasattr(self._parent, 'settings'):
                                self._parent.settings.setValue("admin_name", name)
                        
                        elif event == 'themeSet':
                            theme = data.get('theme')
                            print(f"Theme set: {theme}")
                            if self._parent and hasattr(self._parent, 'settings'):
                                self._parent.settings.setValue("theme", theme)
                    
                    elif msg_type == 'logout':
                        print("Logout event detected from web interface")
                        if self._parent:
                            self._parent.logout(skip_confirmation=True)
                    
                    elif msg_type == 'themeChange':
                        theme = data.get('theme', 'light')
                        if self._parent:
                            self._parent.change_theme(theme)
                    
                    elif msg_type == 'warning':
                        warning_msg = data.get('message', 'Unknown warning')
                        if self._parent:
                            QMessageBox.warning(self._parent, "Warning", warning_msg)
            except Exception as e:
                print(f"Error handling auth console message: {e}")
        
        # Also check for direct logout messages without JSON structure
        elif "userToken removed" in message or "logout" in message.lower():
            print("Logout message detected in console")
            if self._parent:
                self._parent.logout(skip_confirmation=True)

class AdminPanel(QMainWindow):
    def __init__(self):
        super().__init__()
        self.settings = QSettings("AISAT", "AdminPanel")
        icon_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "img/icon.png")

        if os.path.exists(icon_path):
            self.setWindowIcon(QIcon(icon_path))
        else:
            print(f"Icon file not found at: {icon_path}")
            
        # Initialize UI elements as None
        self.web_view = None
        self.auth_view = None
        self.admin_id = None
        
        # Get current theme
        self.current_theme = self.settings.value("theme", "light")
        
        # Set window properties
        self.setWindowTitle('AISAT Admin Dashboard')
        self.setGeometry(100, 100, 1200, 800)
        
        # Ensure window is resizable - using the most compatible approach
        self.setMinimumSize(1320, 924)  # Set reasonable minimum size
        self.setMaximumSize(QWIDGETSIZE_MAX, QWIDGETSIZE_MAX)  # Maximum possible size
        
        # Add shortcut for toggling fullscreen (F11)
        from PyQt5.QtGui import QKeySequence
        from PyQt5.QtWidgets import QShortcut
        self.fullscreen_shortcut = QShortcut(QKeySequence("F11"), self)
        self.fullscreen_shortcut.activated.connect(self.toggle_fullscreen)
        
        # Start the authentication flow
        self.start_authentication()
        
    def toggle_fullscreen(self):
        """Toggle fullscreen mode"""
        if self.isFullScreen():
            self.showNormal()
            print("Exiting fullscreen mode")
            if hasattr(self, "fullscreen_btn"):
                self.fullscreen_btn.setText("Enter Fullscreen")
        else:
            print("Entering fullscreen mode")
            if hasattr(self, "fullscreen_btn"):
                self.fullscreen_btn.setText("Exit Fullscreen")
            self.showFullScreen()
            
    def showEvent(self, event):
        """Override show event to ensure window is resizable when shown"""
        super().showEvent(event)
        # This is a last-resort approach to remove size constraints
        self.setFixedSize(QWIDGETSIZE_MAX, QWIDGETSIZE_MAX)
        
    def resizeEvent(self, event):
        """Override resize event to detect resizing"""
        super().resizeEvent(event)
        new_size = event.size()
        print(f"Window resized to {new_size.width()} x {new_size.height()}")
        
        # If we have a size grip, position it in the bottom right corner
        if hasattr(self, 'sizeGrip') and self.sizeGrip:
            self.sizeGrip.move(
                self.rect().right() - self.sizeGrip.width(),
                self.rect().bottom() - self.sizeGrip.height()
            )

    def start_authentication(self):
        """Begin the authentication flow using auth.html"""
        # Check for existing token
        is_valid, admin_name, admin_id = check_session(self.settings)
        if is_valid:
            # Token is valid or we're offline but have a cached token
            self.admin_name = admin_name
            self.admin_id = admin_id
            self.on_authentication_complete(self.settings.value("auth_token", ""))
        else:
            # No token or invalid token, show auth.html
            self.show_auth_page()
    
    def show_auth_page(self):
        """Show the auth.html page for login/registration"""
        # Create a layout for the auth view
        layout = QVBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        
        # Create a widget to hold the auth view
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # Create the auth view
        self.auth_view = AuthWebView(self)
        layout.addWidget(self.auth_view)
        
        central_widget.setLayout(layout)
        
        # Make the window non-resizable during authentication
        self.make_window_non_resizable()
        
        self.show()

    def on_authentication_complete(self, token):
        """Called when authentication is successful"""
        # Save the token to settings
        self.settings.setValue("auth_token", token)
        
        # Get the admin name and ID from settings
        self.admin_name = self.settings.value("admin_name", "Admin")
        self.admin_id = self.settings.value("admin_id")
        
        # Set admin as active
        self.set_admin_active()
        
        # Make window resizable again
        self.make_window_resizable()
        
        # Remove auth view
        if self.auth_view:
            self.auth_view.deleteLater()
            self.auth_view = None
        
        # Load the main UI
        self.load_main_ui(token)

    def make_window_non_resizable(self):
        """Make the window non-resizable (for login screen)"""
        # For login, we'll still use a fixed size
        current_size = self.size()
        self.setFixedSize(current_size)

    def make_window_resizable(self):
        """Make the window resizable (after login)"""
        # Remove ALL size constraints - this is the key fix
        self.setFixedSize(QWIDGETSIZE_MAX, QWIDGETSIZE_MAX)  # First clear any fixed size
        self.setMinimumSize(0, 0)  # No minimum size
        self.setMaximumSize(QWIDGETSIZE_MAX, QWIDGETSIZE_MAX)  # Maximum possible size
        
        # Show the window
        self.show()

    def center_on_screen(self):
        """Center the window on the screen"""
        try:
            # Get the screen geometry using the most compatible approach
            from PyQt5.QtWidgets import QDesktopWidget
            desktop = QDesktopWidget()
            screen = desktop.screenGeometry(desktop.primaryScreen())
            
            # Calculate the centered position
            window_geometry = self.frameGeometry()
            window_geometry.moveCenter(screen.center())
            self.move(window_geometry.topLeft())
        except Exception as e:
            # Fallback method if the above doesn't work
            print(f"Warning: Could not center window: {e}")
            # Try a simpler approach
            try:
                screen_size = desktop.availableGeometry()
                x = (screen_size.width() - self.width()) // 2
                y = (screen_size.height() - self.height()) // 2
                self.move(x, y)
            except:
                pass  # Silently fail if we can't center the window

    def load_main_ui(self, token):
        """Load the sidepanel.html UI with the authenticated token"""
        # Create a layout for the main view
        layout = QVBoxLayout()
        layout.setContentsMargins(0, 0, 0, 0)
        
        # Create a widget to hold the main view
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # Create the web view for the sidepanel
        self.web_view = WebEngineView(token, None, self.current_theme)
        layout.addWidget(self.web_view)
        
        central_widget.setLayout(layout)
        
        # Make the window fully resizable - use multiple approaches to ensure it works
        # First reset any fixed size constraint
        self.setFixedSize(QWIDGETSIZE_MAX, QWIDGETSIZE_MAX)  
        
        # Then set minimum/maximum sizes
        self.setMinimumSize(100, 100)  # Small minimum size
        self.setMaximumSize(QWIDGETSIZE_MAX, QWIDGETSIZE_MAX)  # Maximum possible size
        
        # Use showNormal to ensure we're not in a maximized/minimized state that could affect resizing
        self.showNormal()
        
        # Load the sidepanel.html file
        sidepanel_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sidepanel.html")
        if os.path.exists(sidepanel_path):
            self.web_view.setUrl(QUrl.fromLocalFile(sidepanel_path))
            try:
                # Use a less type-strict approach to set the console message handler
                setattr(self.web_view.page(), "javaScriptConsoleMessage", self.handleConsoleMessages)
            except Exception as e:
                print(f"Warning: Could not set console message handler: {e}")
        else:
            print(f"ERROR: sidepanel.html not found at {sidepanel_path}")
            QMessageBox.critical(self, "Error", f"Could not find the dashboard UI file at {sidepanel_path}")

    def handleConsoleMessages(self, level, message, line, source):
        """Handle messages from the console in the web view."""
        # Print all console messages for debugging
        print(f"Console: [{level}] {message} (at line {line} in {source})")
        
        # Check for structured messages like {type: 'logout'}
        if '{' in message and '}' in message:
            try:
                # Try to extract JSON-like object from console message
                import re
                import json
                
                json_match = re.search(r'\{.+\}', message)
                if json_match:
                    data = json.loads(json_match.group(0).replace("'", '"'))
                    msg_type = data.get('type')
                    
                    if msg_type == 'menuClick':
                        menu = data.get('menu', '')
                        print(f"Menu clicked: {menu}")
                        
                        # Load additional resources for specific views if needed
                        # Only try to access web_view.page() if web_view exists and has the page method
                        if menu == 'users' and hasattr(self, 'web_view') and self.web_view is not None and hasattr(self.web_view, 'page'):
                            # Example: Preload users data if needed
                            self.web_view.page().runJavaScript("if (typeof fetchUsers === 'function') { fetchUsers(); }")
                    
                    elif msg_type == 'logout':
                        print("Logout event detected from web interface")
                        if self._parent:
                            self._parent.logout(skip_confirmation=True)
                    
                    elif msg_type == 'themeChange':
                        theme = data.get('theme', 'light')
                        if self._parent:
                            self._parent.change_theme(theme)
                    
                    elif msg_type == 'warning':
                        warning_msg = data.get('message', 'Unknown warning')
                        QMessageBox.warning(self, "Warning", warning_msg)
            except Exception as e:
                print(f"Error handling console message: {e}")
        
        # Also check for direct logout messages without JSON structure
        elif "userToken removed" in message or "logout" in message.lower():
            print("Logout message detected in console")
            self.logout(skip_confirmation=True)
    
    def change_theme(self, theme):
        """Change the theme of the application."""
        self.current_theme = theme
        self.settings.setValue("theme", theme)
        
        # Update the theme in the web view if it exists
        if hasattr(self, 'web_view') and self.web_view:
            self.web_view.update_theme(theme)

    def set_admin_active(self):
        """Set the current admin as active in the database."""
        token = self.settings.value("auth_token", "")
        admin_id = self.settings.value("admin_id")
        
        if not token:
            print("No auth token found, cannot set admin as active")
            return False
            
        success = False
        try:
            # Call the API to set admin as active
            response = requests.post(
                f"{API_BASE_URL}/api/admin/update-active-status",
                headers={"Authorization": f"Bearer {token}"},
                json={"is_active": "yes"},
                timeout=10
            )
            
            if response.status_code == 200:
                print("Admin set as active successfully")
                success = True
                
                # Update TV display data to show this admin
                if admin_id:
                    self.update_tv_display_data(admin_id, True)
                
            else:
                print(f"Failed to set admin as active: {response.status_code}")
                
                # Try direct endpoint as fallback
                if admin_id:
                    direct_response = requests.get(
                        f"{API_BASE_URL}/api/set_admin_active?admin_id={admin_id}&is_active=yes",
                        timeout=5
                    )
                    
                    if direct_response.status_code == 200:
                        print(f"Admin {admin_id} set as active successfully using direct endpoint")
                        success = True
                        
                        # Update TV display data to show this admin
                        self.update_tv_display_data(admin_id, True)
                        
                    else:
                        print(f"Failed with direct endpoint: {direct_response.status_code}")
                        
        except Exception as e:
            print(f"Error setting admin as active: {e}")

        return success

    def logout(self, skip_confirmation=False):
        """Log out the current user"""
        should_logout = True
        
        if not skip_confirmation:
            reply = QMessageBox.question(
                self, 
                "Confirm Logout", 
                "Are you sure you want to logout?",
                QMessageBox.Yes | QMessageBox.No,
                QMessageBox.No
            )
            should_logout = (reply == QMessageBox.Yes)
        
        if should_logout:
            print("Performing logout...")
            # Set admin as inactive before logging out
            self.set_admin_inactive()
            
            # Force clear credentials from QSettings
            print("Removing auth tokens and credentials...")
            self.settings.remove("auth_token")
            self.settings.remove("remember_me")
            self.settings.remove("idno")
            self.settings.remove("password")
            # Ensure QSettings writes changes to disk immediately
            self.settings.sync()
            
            # Clear localStorage in the web view if available
            if hasattr(self, 'web_view') and self.web_view:
                js_clear = """
                localStorage.removeItem('userToken');
                localStorage.removeItem('remember');
                localStorage.removeItem('idno');
                localStorage.removeItem('password');
                console.log('All credentials cleared from localStorage');
                """
                try:
                    self.web_view.page().runJavaScript(js_clear)
                except Exception as e:
                    print(f"Error clearing localStorage: {e}")
            
            # Show feedback
            QMessageBox.information(self, "Logout Successful", "You have been logged out successfully.")
            
            # Restart the application
            print("Restarting application...")
            QApplication.quit()
            os.execl(sys.executable, sys.executable, *sys.argv)
            
    def set_admin_inactive(self):
        """Set the current admin as inactive in the database with improved reliability."""
        token = self.settings.value("auth_token", "")
        admin_id = self.settings.value("admin_id")
        
        if not token:
            print("No auth token found, cannot set admin as inactive")
            return False
        
        # Try multiple approaches to ensure the admin is marked inactive
        approaches_tried = 0
        success = False
        
        # Always update TV display data first to immediately remove admin window
        if admin_id:
            tv_success = self.update_tv_display_data(admin_id, False)
            if tv_success:
                print(f"Successfully removed admin {admin_id} from TV display")
                # Mark partial success - we at least removed the window from the display
                success = True
        
        # Approach 1: Use the authenticated update-active-status endpoint
        approaches_tried += 1
        try:
            print(f"Approach {approaches_tried}: Using authenticated update-active-status endpoint")
            response = requests.post(
                f"{API_BASE_URL}/api/admin/update-active-status",
                headers={"Authorization": f"Bearer {token}"},
                json={"is_active": "no"},
                timeout=5
            )
            
            if response.status_code == 200:
                print(f"Admin set as inactive successfully using authenticated endpoint")
                success = True
            else:
                print(f"Failed with status code: {response.status_code}")
        except Exception as e:
            print(f"Error using authenticated endpoint: {e}")
        
        # Approach 2: Use the direct set_admin_active endpoint if we have admin_id
        if not success and admin_id:
            approaches_tried += 1
            try:
                print(f"Approach {approaches_tried}: Using direct set_admin_active endpoint")
                direct_response = requests.get(
                    f"{API_BASE_URL}/api/set_admin_active?admin_id={admin_id}&is_active=no",
                    timeout=5
                )
                
                if direct_response.status_code == 200:
                    print(f"Admin {admin_id} set as inactive successfully using direct endpoint")
                    success = True
                else:
                    print(f"Failed with status code: {direct_response.status_code}")
            except Exception as e:
                print(f"Error using direct endpoint: {e}")
        
        # Approach 3: Try a simpler endpoint as last resort
        if not success and admin_id:
            approaches_tried += 1
            try:
                print(f"Approach {approaches_tried}: Using admin_logout endpoint")
                logout_response = requests.get(
                    f"{API_BASE_URL}/api/admin_logout?admin_id={admin_id}",
                    timeout=5
                )
                
                if logout_response.status_code == 200:
                    print(f"Admin {admin_id} logged out successfully using admin_logout endpoint")
                    success = True
                else:
                    print(f"Failed with status code: {logout_response.status_code}")
            except Exception as e:
                print(f"Error using admin_logout endpoint: {e}")
        
        if success:
            print(f"Successfully set admin as inactive using approach {approaches_tried}")
        else:
            print(f"WARNING: Failed to set admin as inactive after {approaches_tried} attempts")
            
        # Return whether we were successful
        return success

    def update_tv_display_data(self, admin_id, is_active):
        """Update TV display data to show/hide this admin."""
        if not admin_id:
            print("No admin ID available, cannot update TV display data")
            return False
            
        try:
            print(f"Directly updating TV display data for admin {admin_id}, active={is_active}")
            
            # First get current TV display data
            tv_response = requests.get(
                f"{API_BASE_URL}/api/tv_display_data",
                timeout=5
            )
            
            if tv_response.status_code == 200:
                tv_data = tv_response.json()
                updated = False
                
                # Create default display data structure if none exists
                if not tv_data or all(key == 'lastUpdated' for key in tv_data.keys()):
                    tv_data = {
                        'default': {
                            'timestamp': datetime.now().isoformat(),
                            'adminWindows': {}
                        },
                        'lastUpdated': datetime.now().isoformat()
                    }
                
                # Process each display in the data
                for display_id in tv_data:
                    if display_id != 'lastUpdated' and 'adminWindows' in tv_data[display_id]:
                        if is_active:
                            # If active, add/update the admin in windows
                            tv_data[display_id]['adminWindows'][str(admin_id)] = {
                                'isActive': 'yes',
                                'roomName': f"Room {admin_id}"
                            }
                            updated = True
                        else:
                            # If inactive, remove the admin from windows
                            if str(admin_id) in tv_data[display_id]['adminWindows']:
                                del tv_data[display_id]['adminWindows'][str(admin_id)]
                                updated = True
                
                if updated:
                    # Update the timestamp
                    tv_data['lastUpdated'] = datetime.now().isoformat()
                    
                    # Send the updated data back
                    update_response = requests.post(
                        f"{API_BASE_URL}/api/tv_display_data",
                        json=tv_data,
                        timeout=5
                    )
                    
                    if update_response.status_code == 200:
                        print(f"Successfully updated TV display data for admin {admin_id}")
                        return True
                    else:
                        print(f"Failed to update TV display data: {update_response.status_code}")
                else:
                    if is_active:
                        print(f"Admin {admin_id} already active in TV display data")
                        return True
                    else:
                        print(f"Admin {admin_id} not found in TV display data, nothing to remove")
                        return True
            else:
                print(f"Failed to get TV display data: {tv_response.status_code}")
                
        except Exception as e:
            print(f"Error updating TV display data: {e}")
            
        return False
            
    def closeEvent(self, event):
        """Handle the window close event."""
        print("Application closing - setting admin as inactive")
        if self.set_admin_inactive():
            print("Admin successfully marked as inactive before closing")
        else:
            print("WARNING: Could not mark admin as inactive before closing")
        event.accept()

def main():
    app = QApplication(sys.argv)
    window = AdminPanel()
    sys.exit(app.exec_())

if __name__ == '__main__':
    main()
