// printer.js - Thermal printer integration for AISAT Admin
console.log("Thermal printer module loading...");

// Default to printer not available until main.py injects the real value
window.thermalPrinterAvailable = false;

// Create a dummy function that will be replaced by main.py if printer is available
window.printThermalReceipt = function(receiptData) {
    console.error("Real printer function not yet initialized");
    return Promise.reject(new Error("Printer not initialized"));
};

// Create a dummy test function that will be replaced by main.py
window.testThermalPrinter = function() {
    console.error("Test printer function not yet initialized");
    return Promise.reject(new Error("Printer not initialized"));
};

// Create a helper to check if printer is properly initialized
window.isPrinterInitialized = function() {
    // Check if the real printer function has been injected (it returns a Promise)
    try {
        const testCall = window.printThermalReceipt({test: true});
        return typeof testCall === 'object' && typeof testCall.then === 'function';
    } catch (error) {
        console.error("Printer initialization check failed:", error);
        return false;
    }
};

// Function to create a test receipt
window.createSampleReceipt = function() {
    return {
        requestId: "TEST-123",
        studentId: "2023-SAMPLE",
        studentName: "Test Student",
        date: "January 1, 2023",
        time: "12:00 PM",
        level: "College",
        paymentType: "Regular",
        paymentMethod: "Full Payment"
    };
};

// Wait for DOM to be ready and check printer status
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, checking printer...");
    
    // Check printer status repeatedly until available or timeout
    let checkCount = 0;
    const maxChecks = 10;
    
    function checkPrinter() {
        console.log("Checking thermal printer availability...");
        checkCount++;
        
        if (window.isPrinterInitialized()) {
            console.log("✓ Thermal printer initialized and available");
            // Dispatch event that printer is ready
            document.dispatchEvent(new CustomEvent('printerReady'));
            return;
        }
        
        if (checkCount < maxChecks) {
            // Try again in 1 second
            setTimeout(checkPrinter, 1000);
        } else {
            console.error("× Failed to initialize thermal printer after multiple attempts");
            // Dispatch event that printer failed
            document.dispatchEvent(new CustomEvent('printerFailed'));
        }
    }
    
    // Start checking
    setTimeout(checkPrinter, 1000);
});

console.log("Thermal printer module loaded"); 