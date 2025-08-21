import os
import sys
import subprocess
import time
import signal
import threading
import psutil

def kill_process_on_port(port):
    """Kill any process running on the specified port"""
    for proc in psutil.process_iter(['pid', 'name', 'connections']):
        try:
            for conn in proc.connections():
                if conn.laddr.port == port:
                    print(f"Found process {proc.pid} using port {port}, killing it...")
                    psutil.Process(proc.pid).terminate()
                    time.sleep(0.5)
                    if psutil.pid_exists(proc.pid):
                        psutil.Process(proc.pid).kill()
                    return True
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue
    return False

def start_printer_server():
    """Start the Flask printer server"""
    port = 5000
    
    # Check if the port is in use and kill any process using it
    kill_process_on_port(port)
    
    # Start the printer server
    print(f"Starting printer server on port {port}...")
    printer_server_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "print_server.py")
    
    if not os.path.exists(printer_server_path):
        print(f"Error: Printer server script not found at {printer_server_path}")
        return None
        
    # Start the server as a subprocess
    server_process = subprocess.Popen(
        [sys.executable, printer_server_path, str(port)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True
    )
    
    # Wait for the server to start
    time.sleep(1)
    if server_process.poll() is not None:
        # Server failed to start
        stdout, stderr = server_process.communicate()
        print(f"Error starting printer server: {stderr}")
        return None
        
    print(f"Printer server started with PID {server_process.pid}")
    return server_process

def start_main_application():
    """Start the main PyQt application"""
    print("Starting main application...")
    main_app_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "main.py")
    
    if not os.path.exists(main_app_path):
        print(f"Error: Main application script not found at {main_app_path}")
        return None
        
    # Start the main application as a subprocess
    main_process = subprocess.Popen(
        [sys.executable, main_app_path],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        universal_newlines=True
    )
    
    print(f"Main application started with PID {main_process.pid}")
    return main_process

def monitor_process_output(process, name):
    """Monitor and print the output from a process"""
    for line in process.stdout:
        print(f"{name}: {line.strip()}")

if __name__ == "__main__":
    print("Starting AISAT Admin with thermal printer support...")
    
    # Start printer server
    printer_server = start_printer_server()
    if printer_server is None:
        sys.exit(1)
        
    # Start monitoring printer server output in a separate thread
    printer_thread = threading.Thread(
        target=monitor_process_output,
        args=(printer_server, "Printer Server"),
        daemon=True
    )
    printer_thread.start()
    
    # Start main application
    main_app = start_main_application()
    if main_app is None:
        printer_server.terminate()
        sys.exit(1)
        
    # Monitor main application output in a separate thread
    main_thread = threading.Thread(
        target=monitor_process_output,
        args=(main_app, "Main App"),
        daemon=True
    )
    main_thread.start()
    
    try:
        # Wait for the main application to exit
        main_app.wait()
    except KeyboardInterrupt:
        print("Keyboard interrupt received, shutting down...")
    finally:
        # Clean up
        print("Shutting down printer server...")
        if printer_server and printer_server.poll() is None:
            printer_server.terminate()
            try:
                printer_server.wait(timeout=5)
            except subprocess.TimeoutExpired:
                printer_server.kill()
        
        print("Shutting down main application...")
        if main_app and main_app.poll() is None:
            main_app.terminate()
            try:
                main_app.wait(timeout=5)
            except subprocess.TimeoutExpired:
                main_app.kill()
        
        print("All processes terminated, exiting.") 