import win32print
import json

class PosSys():
    def __init__(self, custom_text=None):
        # Try to get the default printer name
        try:
            # Try to find a thermal printer by common names
            common_thermal_names = ["POS58", "Thermal", "Receipt", "POS Printer", "POS58 Printer", "POSPrinter"]
            printers = [printer[2] for printer in win32print.EnumPrinters(2)]
            print("Available printers:", printers)
            
            # First try to match a thermal printer
            thermal_printer = None
            for printer in printers:
                for name in common_thermal_names:
                    if name.lower() in printer.lower():
                        thermal_printer = printer
                        break
                if thermal_printer:
                    break
            
            # Use thermal printer if found, otherwise default
            if thermal_printer:
                self.printer_name = thermal_printer
                print(f"Found thermal printer: {self.printer_name}")
            else:
                self.printer_name = win32print.GetDefaultPrinter()
                print(f"No thermal printer found, using default: {self.printer_name}")
        except Exception as e:
            # Fallback to hardcoded name
            self.printer_name = "POS58 Printer"
            print(f"Error finding printer: {e}")
            print("Using fallback printer name:", self.printer_name)
        
        # If custom text is provided, use it directly
        if custom_text:
            self.text_to_print = custom_text
        else:
            # Otherwise, load from JSON file (original functionality)
            try:
                # Load JSON data
                with open('data/receipt.json') as file:
                    data = json.load(file)
                
                self.text_to_print = "SOCKIO - San Sebastian College \n Recoletos De Cavite\n\n =============================== \n\n\n"
                for item in data['items']:
                    line = f"{item['name']} x {item['quantity']} - ${item['price']}"
                    self.text_to_print += line.ljust(40) + "\n"  

                self.text_to_print += f"\n\n ===============================\n\n Total: ${data['total_price']} \n\n Thankyou For Purchasing\n\n\n".ljust(40)
            except Exception as e:
                self.text_to_print = "Error printing receipt"
        
        # Don't return anything from __init__
        
    def print_receipt(self):
        try:
            print(f"Attempting to print to printer: {self.printer_name}")
            
            # Open the printer
            printer = win32print.OpenPrinter(self.printer_name)
            print("Printer opened successfully")
            
            # Fix the StartDocPrinter arguments - all three must be strings or string/None
            win32print.StartDocPrinter(printer, 1, ("Receipt", "", "RAW"))
            print("Document started")
            
            win32print.StartPagePrinter(printer)
            print("Page started")

            # Reset printer settings
            win32print.WritePrinter(printer, b'\x1B\x40')
            
            # Set text size (normal)
            win32print.WritePrinter(printer, b'\x1B\x21\x00')
            
            # Center align
            win32print.WritePrinter(printer, b'\x1B\x61\x01')
            
            # Print the text content
            print(f"Printing text ({len(self.text_to_print)} chars)")
            win32print.WritePrinter(printer, self.text_to_print.encode("utf-8"))
            
            # Reset to normal size
            win32print.WritePrinter(printer, b'\x1B\x21\x00')

            # Left align
            win32print.WritePrinter(printer, b'\x1B\x61\x00')

            # Add extra line
            win32print.WritePrinter(printer, b'\n')
            
            # Cut paper
            win32print.WritePrinter(printer, b'\x1D\x56\x00')
            
            # End the page and document
            win32print.EndPagePrinter(printer)
            win32print.EndDocPrinter(printer)
            win32print.ClosePrinter(printer)
            
            print("Receipt printed successfully!")
            return True
        except Exception as e:
            print(f"ERROR printing receipt: {e}")
            return False

# Function to print a test receipt
def print_test_receipt():
    test_text = """
AISAT CARES - TEST RECEIPT
==========================

This is a test receipt
to verify the thermal 
printer is working properly.

==========================
Test completed successfully!

"""
    return PosSys(test_text)

# Only run this if executed directly (not when imported)
if __name__ == "__main__":
    print_test_receipt()
