// User Appointment Calendar
class AppointmentCalendar {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.options = {
            baseUrl: "https://jimboyaczon.pythonanywhere.com",
            onDateSelected: null,
            ...options
        };
        
        this.today = new Date();
        this.currentMonth = this.today.getMonth();
        this.currentYear = this.today.getFullYear();
        this.selectedDate = null;
        
        this.init();
    }
    
    init() {
        this.createCalendarStructure();
        this.setupEventListeners();
        this.renderCalendar();
    }
    
    createCalendarStructure() {
        // Create container elements
        this.container.innerHTML = `
            <div class="calendar-header">
                <button class="prev-month">&lt;</button>
                <div class="current-month-year"></div>
                <button class="next-month">&gt;</button>
            </div>
            <div class="calendar-status">
                <div class="status-indicator">
                    <div class="status-item">
                        <div class="status-color status-open"></div>
                        <span>Available</span>
                    </div>
                    <div class="status-item">
                        <div class="status-color status-full"></div>
                        <span>Full</span>
                    </div>
                    <div class="status-item">
                        <div class="status-color status-unavail"></div>
                        <span>Unavailable</span>
                    </div>
                </div>
            </div>
            <div id="calendar-loading" class="loading">Loading calendar data...</div>
            <div id="calendar-message" class="calendar-message"></div>
            <div class="calendar-grid"></div>
        `;
        
        // Get references to elements
        this.calendarGrid = this.container.querySelector('.calendar-grid');
        this.currentMonthYearDisplay = this.container.querySelector('.current-month-year');
        this.prevMonthBtn = this.container.querySelector('.prev-month');
        this.nextMonthBtn = this.container.querySelector('.next-month');
        this.loadingMessage = this.container.querySelector('#calendar-loading');
        this.statusMessage = this.container.querySelector('#calendar-message');
    }
    
    setupEventListeners() {
        this.prevMonthBtn.addEventListener('click', () => {
            this.currentMonth--;
            if (this.currentMonth < 0) {
                this.currentMonth = 11;
                this.currentYear--;
            }
            this.renderCalendar();
        });
        
        this.nextMonthBtn.addEventListener('click', () => {
            this.currentMonth++;
            if (this.currentMonth > 11) {
                this.currentMonth = 0;
                this.currentYear++;
            }
            this.renderCalendar();
        });
    }
    
    renderCalendar() {
        this.calendarGrid.innerHTML = '';
        this.loadingMessage.style.display = 'block';
        
        // Add day names
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayNames.forEach(day => {
            const dayNameEl = document.createElement('div');
            dayNameEl.className = 'day-name';
            dayNameEl.textContent = day;
            this.calendarGrid.appendChild(dayNameEl);
        });
        
        // Update month/year display
        const monthNames = [...Array(12).keys()].map(i => 
            new Date(0, i).toLocaleString('default', { month: 'long' })
        );
        this.currentMonthYearDisplay.textContent = `${monthNames[this.currentMonth]} ${this.currentYear}`;
        
        const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
        const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();
        
        for (let i = 0; i < firstDay; i++) {
            const emptyCell = document.createElement('div');
            this.calendarGrid.appendChild(emptyCell);
        }
        
        cordovaFetch(`${this.options.baseUrl}/api/calendar`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server returned status ${response.status}`);
                }
                return response.json();
            })  
            .then(data => {
                this.loadingMessage.style.display = 'none';
                
                // Add day cells
                for (let i = 1; i <= daysInMonth; i++) {
                    const date = new Date(this.currentYear, this.currentMonth, i);
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const dateStr = `${year}-${month}-${day}`;
                    
                    // Get status from server data or default to unavailable
                    const status = data[dateStr] || 'unavail';
                    
                    const dayEl = document.createElement('div');
                    dayEl.className = `day ${status}`;
                    dayEl.textContent = i;
                    dayEl.dataset.date = dateStr;
                    
                    // Only allow clicking on 'open' days
                    if (status === 'open') {
                        dayEl.classList.add('selectable');
                        dayEl.addEventListener('click', () => this.onDateClick(dateStr, dayEl));
                    }
                    
                    this.calendarGrid.appendChild(dayEl);
                }
            })
            .catch(error => {
                console.error("Calendar fetch error:", error);
                this.loadingMessage.style.display = 'none';
                this.showMessage(`Failed to load calendar data. Please try again later.`, true);
                
                    for (let i = 1; i <= daysInMonth; i++) {
                    const date = new Date(this.currentYear, this.currentMonth, i);
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const dateStr = `${year}-${month}-${day}`;
                    
                    const dayEl = document.createElement('div');
                    dayEl.className = 'day unavail';
                    dayEl.textContent = i;
                    dayEl.dataset.date = dateStr;
                    
                    this.calendarGrid.appendChild(dayEl);
                }
            });
    }
    
    onDateClick(dateStr, dayEl) {
        // Reset previously selected date
        const previouslySelected = this.calendarGrid.querySelector('.day.selected');
        if (previouslySelected) {
            previouslySelected.classList.remove('selected');
        }
        
        dayEl.classList.add('selected');
        this.selectedDate = dateStr;
        
        // Add a small visual delay before proceeding
        setTimeout(() => {
            // Call callback if provided
            if (this.options.onDateSelected) {
                this.options.onDateSelected(dateStr);
            }
        }, 300); // Short delay for visual feedback
    }
    
    showMessage(message, isError = false) {
        this.statusMessage.textContent = message;
        this.statusMessage.className = `calendar-message ${isError ? 'error' : 'success'}`;
        this.statusMessage.style.display = 'block';
        
        setTimeout(() => {
            this.statusMessage.style.display = 'none';
        }, 3000);
    }
}

// Export the calendar class
window.AppointmentCalendar = AppointmentCalendar;
