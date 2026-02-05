from flask import Flask, request, jsonify
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service  # Add this import
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import traceback
import time
import re
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

@app.route('/process-data', methods=['POST'])
def process_data():
    try:
        data = request.json
        # Extract your specific variables
        DRIVER_NAME = data.get('driver_name')
        LICENSE_NUM = data.get('driver_license')
        VEHICLE_NUM = data.get('vehicle_num')
        DESTINATION = data.get('destination')
        WEIGHT = data.get('weight')
        SO_NO = data.get('so_no')
        PHONE_NUMBER = data.get('phone_num')
        
        print(f"Received data:")
        print(f"Driver Name: {DRIVER_NAME}")
        print(f"License: {LICENSE_NUM}")
        print(f"Vehicle: {VEHICLE_NUM}")
        print(f"Destination: {DESTINATION}")
        print(f"Weight: {WEIGHT}")
        print(f"SO Number: {SO_NO}")
        print(f"Phone: {PHONE_NUMBER}")
        
        # Process your data here - add your processing logic
        USERNAME = os.getenv('USERNAME')
        PASSWORD = os.getenv('PASSWORD')
        HEADLESS = True
        ERROR_MESSAGE = None
        ACTUAL_QUANTITY = None  # Track the actual quantity used for AP
        
        # Configure Chrome options
        # Configure Chrome options - FIXED VERSION
        options = Options()
        if HEADLESS:
            # Use new headless mode (more stable)
            options.add_argument("--headless=new")
            options.add_argument("--no-sandbox")
            options.add_argument("--disable-dev-shm-usage")
            options.add_argument("--disable-gpu")
            options.add_argument("--disable-extensions")
            options.add_argument("--disable-plugins")
            options.add_argument("--disable-images")
            
            # Window and display settings
            options.add_argument("--window-size=1920,1080")
            options.add_argument("--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36")
            
            # Use unique data directory for each request to avoid conflicts
            import tempfile
            temp_dir = tempfile.mkdtemp(prefix='chrome_selenium_')
            options.add_argument(f"--user-data-dir={temp_dir}")
            
            # Use different port to avoid conflicts (changed from 9222)
            options.add_argument("--remote-debugging-port=9223")
            
            # Background execution optimizations
            options.add_argument("--disable-background-timer-throttling")
            options.add_argument("--disable-backgrounding-occluded-windows")
            options.add_argument("--disable-renderer-backgrounding")
            
            # UI and feature disabling
            options.add_argument("--disable-features=TranslateUI")

        
        

        # Add ChromeDriver service configuration with error handling

        print("Creating Chrome service...")
        service = Service('/usr/bin/chromedriver')
        
        print("Starting Chrome driver...")
        driver = webdriver.Chrome(service=service, options=options)
        
        print("Chrome driver started successfully!")
        
        # YOUR EXISTING SELENIUM CODE CONTINUES HERE...
        # Don't change anything after this point, just add the cleanup at the end

        # Your selenium automation code continues here...

        # Step 1: Open login page
        print("🌐 Opening login page...")
        try:
            driver.get("https://dfpcl.autoplant.in/AutoplantVC/transporter_report.do?method=getTransporterReport&status=planned")
            print("🌐 Opened login page")

        except Exception as e:
            ERROR_MESSAGE = f"❌ Could not open login page"
            print(ERROR_MESSAGE)
            raise Exception(ERROR_MESSAGE)


        # Step 2: Log in
        print("🔐 Logging in...")
        try:
            WebDriverWait(driver, 10).until(EC.presence_of_element_located((By.NAME, "username")))
            driver.find_element(By.NAME, "username").send_keys(USERNAME)
            driver.find_element(By.NAME, "password").send_keys(PASSWORD + Keys.RETURN)
            print("🔐 Login submitted")

        except Exception as e:
            ERROR_MESSAGE = f"❌ Could not log in, Wrong Username or Password"
            print(ERROR_MESSAGE)
            raise Exception(ERROR_MESSAGE)

        # Step 3: Wait until sidebar toggle appears
        try:
            toggle = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CLASS_NAME, "sidebar-toggle"))
            )
            
            # Scroll into view and click via JS
            driver.execute_script("arguments[0].scrollIntoView(true);", toggle)
            print("📂 Sidebar toggle clicked via JS")

        except Exception as e:
            ERROR_MESSAGE = f"❌ Could not find sidebar toggle (Username or password might be wrong)"
            print(ERROR_MESSAGE)
            raise Exception(ERROR_MESSAGE)

        # Step 4: Click 'Vendor Collaboration'
        # try:
        #     dropdown = WebDriverWait(driver, 10).until(
        #         EC.element_to_be_clickable((By.LINK_TEXT, "Vendor Collaboration"))
        #     )
        #     dropdown.click()
        #     print("✅ Clicked 'Vendor Collaboration'")

        # except Exception as e:
        #     ERROR_MESSAGE = f"❌ Could not click 'Vendor Collaboration' dropdown"
        #     print(ERROR_MESSAGE)
        #     raise Exception(ERROR_MESSAGE)

        # # Step 5: Click 'Available Orders Report'
        # try: 
        #     report_link = WebDriverWait(driver, 10).until(
        #         EC.element_to_be_clickable((By.LINK_TEXT, "Available Orders Report"))
        #     )
        #     report_link.click()
        #     print("✅ Clicked 'Available Orders Report'")

        # except Exception as e:
        #     ERROR_MESSAGE = f"❌ Could not click 'Available Orders Report'"
        #     print(ERROR_MESSAGE)
        #     raise Exception(ERROR_MESSAGE)

        # # Step 6: Search for SO number
        # search_box = WebDriverWait(driver, 10).until(
        #     EC.presence_of_element_located((By.ID, "jqgid_globalSearch"))
        # )
        # search_box.clear()
        # search_box.send_keys(str(SO_NO))
        # search_box.send_keys(Keys.RETURN)
        # print("✅ SO number searched successfully")
        
        # # Wait for search results to load
        # time.sleep(2)

        # # Check if search results exist
        # print(f"🔍 Checking if search results exist for SO_NO = {SO_NO}")
        # search_results_found = False
        
        # try:
        #     # Check for the presence of checkboxes with SO_NO pattern
        #     checkboxes = driver.find_elements(By.XPATH, f"//input[starts-with(@id, 'OrderNo_{SO_NO}_')]")
            
        #     if len(checkboxes) > 0:
        #         search_results_found = True
        #         print(f"✅ Found {len(checkboxes)} search result(s) for SO_NO = {SO_NO}")
        #     else:
        #         print(f"❌ No search results found for SO_NO = {SO_NO}")
        #         # Also check for any table rows or data rows to be sure
        #         data_rows = driver.find_elements(By.XPATH, "//tr[contains(@class, 'jqgrow')]")
        #         if len(data_rows) == 0:
        #             print("❌ No data rows found in the table - confirming no search results")
        #         else:
        #             print(f"⚠️ Found {len(data_rows)} data rows but no matching SO_NO checkboxes")
        #             # Check if any of these rows contain our SO_NO
        #             for row in data_rows:
        #                 if str(SO_NO) in row.text:
        #                     search_results_found = True
        #                     print(f"✅ Found SO_NO {SO_NO} in table data")
        #                     break
                            
        # except Exception as e:
        #     ERROR_MESSAGE = "⚠️ Error checking for search results: {e}"
        #     print(f"⚠️ Error checking for search results: {e}")
        #     search_results_found = False

        # # Conditional execution: Steps 7-9 only if search results are found
        # if search_results_found:
        #     print("🔄 Search results found - proceeding with steps 7-9")
            
        #     # Step 7: Find and click checkbox - Method 1 only
        #     print(f"🔍 Looking for checkbox with SO_NO = {SO_NO}")
            
        #     try:
        #         checkbox = WebDriverWait(driver, 10).until(
        #             EC.element_to_be_clickable((By.XPATH, f"//input[starts-with(@id, 'OrderNo_{SO_NO}_')]"))
        #         )
        #         checkbox.click()
        #         print(f"✅ Clicked checkbox with SO_NO = {SO_NO}")
        #     except Exception as e:
        #         ERROR_MESSAGE = f"Could not find checkbox for SO_NO = {SO_NO}"
        #         print(ERROR_MESSAGE)
        #         raise Exception(ERROR_MESSAGE)

        #     # Step 8: Click the Commit button
        #     print("🔍 Looking for Commit button...")
            
        #     try:
        #         commit_btn = WebDriverWait(driver, 10).until(
        #             EC.element_to_be_clickable((By.ID, "commitBtnTOO"))
        #         )
        #         commit_btn.click()
        #         print("✅ Clicked Commit button by ID")
        #     except Exception as e:
        #         ERROR_MESSAGE = f"Could not find or click the Commit button"
        #         raise Exception(ERROR_MESSAGE)

        #     # Step 9: Handle Two-Step Confirmation Process
        #     print("🔍 Handling two-step confirmation process...")
            
        #     # FIRST POP-UP: Confirmation popup
        #     print("⏳ Waiting for first confirmation popup...")
        #     try:
        #         WebDriverWait(driver, 10).until(EC.alert_is_present())
        #         alert1 = driver.switch_to.alert
        #         alert1_text = alert1.text
        #         print(f"📢 First Alert found: '{alert1_text}'")
                
        #         # Verify if the first popup contains the expected SO number
        #         # Expected format: 'Do you want to Commit these Order No's ?? 1. Order No : 2200478050_010-1-1'
        #         so_number_found = False
                
        #         # Use regex to find SO number patterns (with various suffixes)
        #         so_pattern = rf"{SO_NO}[_-]\d+[_-]\d+[_-]\d+"
        #         matches = re.findall(so_pattern, alert1_text)
                
        #         if matches:
        #             print(f"✅ FIRST CONFIRMATION: SO number found in format: {matches[0]}")
        #             so_number_found = True
        #         elif str(SO_NO) in alert1_text:
        #             print(f"✅ FIRST CONFIRMATION: SO number {SO_NO} found in alert")
        #             so_number_found = True
        #         else:
        #             print(f"⚠️ WARNING: SO number {SO_NO} not found in first confirmation popup")
                
        #         # Check if it's a confirmation dialog
        #         is_confirmation = any(keyword.lower() in alert1_text.lower() 
        #                             for keyword in ['do you want to commit', 'commit these order', 'confirm'])
                
        #         if is_confirmation and so_number_found:
        #             print("✅ First popup is valid confirmation dialog with correct SO number")
        #             alert1.accept()  # Click OK
        #             print("✅ First confirmation popup accepted")
        #         elif is_confirmation:
        #             print("⚠️ First popup is confirmation dialog but SO number verification unclear")
        #             alert1.accept()  # Click OK anyway
        #             print("⚠️ First confirmation popup accepted (with warning)")
        #         else:
        #             print("❌ First popup doesn't appear to be a confirmation dialog")
        #             alert1.accept()  # Click OK to proceed
                    
        #     except Exception as e:
        #         ERROR_MESSAGE = f"❌ Error handling first popup after committing"
        #         print(ERROR_MESSAGE)
        #         raise Exception(ERROR_MESSAGE)
            
        #     # Wait a moment between popups
        #     time.sleep(1)
            
        #     # SECOND POP-UP: Success confirmation popup
        #     print("⏳ Waiting for second success popup...")
        #     try:
        #         WebDriverWait(driver, 10).until(EC.alert_is_present())
        #         alert2 = driver.switch_to.alert
        #         alert2_text = alert2.text
        #         print(f"📢 Second Alert found: '{alert2_text}'")
                
        #         # Verify the second popup format
        #         # Expected format: "ORDER NO:2200478050_010_1, MESSAGE: ORDER COMMIT SUCCESS"
                
        #         # Extract SO number from the success message
        #         so_in_success = False
        #         success_message_found = False
                
        #         # Check for SO number in various formats
        #         so_patterns = [
        #             rf"ORDER NO:\s*{SO_NO}[_-]\d+[_-]\d+",
        #             rf"ORDER NO:\s*{SO_NO}[_\-\d]*",
        #             rf"{SO_NO}[_-]\d+[_-]\d+"
        #         ]
                
        #         extracted_so = None
        #         for pattern in so_patterns:
        #             matches = re.findall(pattern, alert2_text)
        #             if matches:
        #                 extracted_so = matches[0]
        #                 so_in_success = True
        #                 break
                
        #         if not so_in_success and str(SO_NO) in alert2_text:
        #             so_in_success = True
        #             extracted_so = str(SO_NO)
                
        #         # Check for success message - exact format: "MESSAGE: ORDER COMMIT SUCCESS"
        #         success_message_found = "MESSAGE: ORDER COMMIT SUCCESS" in alert2_text
                
        #         # Final verification and logging
        #         if so_in_success and success_message_found:
        #             print("🎉 COMMIT OPERATION SUCCESSFUL!")
        #             print(f"   ✓ SO Number Verified: {extracted_so if extracted_so else SO_NO}")
        #             print(f"   ✓ Success Message Confirmed: MESSAGE: ORDER COMMIT SUCCESS")
        #             print(f"   ✓ Full Message: {alert2_text}")
                    
        #             # Record the success
        #             success_record = {
        #                 "so_number": SO_NO,
        #                 "extracted_so": extracted_so,
        #                 "success_message": alert2_text,
        #                 "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        #                 "status": "SUCCESS"
        #             }
        #             print(f"📋 Success Record: {success_record}")
                    
        #         elif success_message_found:
        #             print("⚠️ SUCCESS MESSAGE found but SO number verification unclear")
        #             print(f"   Expected SO: {SO_NO}")
        #             print(f"   Message: {alert2_text}")
        #         else:
        #             print("❌ Second popup doesn't contain expected success message")
        #             print(f"   Expected: MESSAGE: ORDER COMMIT SUCCESS with SO {SO_NO}")
        #             print(f"   Actual: {alert2_text}")
                
        #         alert2.accept()  # Click OK on success popup
        #         print("✅ Second popup dismissed")
                
        #     except Exception as e:
        #         ERROR_MESSAGE = f"❌ Error handling second popup after committing"
        #         print(ERROR_MESSAGE)
        #         # Check if maybe there's no second popup and the page has changed
        #         try:
        #             current_url = driver.current_url
        #             print(f"Current URL after first popup: {current_url}")
                    
        #             # Look for success messages on the page itself
        #             success_elements = driver.find_elements(By.XPATH, 
        #                 "//*[contains(text(), 'SUCCESS') or contains(text(), 'COMMIT') or contains(text(), 'success')]")
                    
        #             if success_elements:
        #                 for element in success_elements:
        #                     element_text = element.text.strip()
        #                     if element_text and str(SO_NO) in element_text:
        #                         print(f"📢 Success message found on page: '{element_text}'")
        #                         break
                    
        #         except:
        #             pass
        # else:
        #     print("⏭️ No search results found - skipping steps 7-9 and continuing from step 10")

        
        # # Step 10: Click on totalOrders radio button
        # print("🔍 Step 10: Looking for totalOrders radio button...")
        # try:
        #     total_orders_radio = WebDriverWait(driver, 10).until(
        #         EC.element_to_be_clickable((By.ID, "totalOrders"))
        #     )
        #     total_orders_radio.click()
        #     print("✅ Step 10: Clicked totalOrders radio button")
        # except Exception as e:
        #     ERROR_MESSAGE = "❌ Could not go to TOTAL ORDERS page"
        #     print(ERROR_MESSAGE)
        #     raise Exception(ERROR_MESSAGE)

        # # Step 11: Click on commit_allocated radio button
        # print("🔍 Step 11: Looking for commit_allocated radio button...")
        # try:
        #     commit_allocated_radio = WebDriverWait(driver, 10).until(
        #         EC.element_to_be_clickable((By.ID, "commit_allocated"))
        #     )
        #     commit_allocated_radio.click()
        #     print("✅ Step 11: Clicked commit_allocated radio button")
        # except Exception as e:
        #     ERROR_MESSAGE = "❌ Could not go to COMMIT/ALLOCATED ORDERS page"
        #     print(ERROR_MESSAGE)
        #     raise Exception(ERROR_MESSAGE)
        
        # # Step 6 (again): Search for SO number
        # search_box = WebDriverWait(driver, 10).until(
        #     EC.presence_of_element_located((By.ID, "jqgid_globalSearch"))
        # )
        # search_box.clear()
        # search_box.send_keys(str(SO_NO))
        # search_box.send_keys(Keys.RETURN)
        # print("✅ SO number searched successfully")
        
        # # Wait for search results to load
        # time.sleep(2)
        
        # # Step 12: Click on SplitOrder radio button with SO_NO in value
        # print(f"🔍 Step 12: Looking for SplitOrder radio button with SO_NO {SO_NO}...")
        # try:
        #     # Find radio button where value starts with SO_NO
        #     split_order_radio = WebDriverWait(driver, 10).until(
        #         EC.element_to_be_clickable((By.XPATH, f"//input[@name='SplitOrder' and starts-with(@value, '{SO_NO}_')]"))
        #     )
        #     # Get the value to verify it contains the SO_NO
        #     radio_value = split_order_radio.get_attribute("value")
        #     print(f"✅ Found radio button with value: {radio_value}")
            
        #     # Verify SO_NO is at the beginning of the value
        #     if radio_value and radio_value.startswith(str(SO_NO)):
        #         split_order_radio.click()
        #         print(f"✅ Step 12: Clicked SplitOrder radio button with SO_NO {SO_NO}")
        #         print(f"📝 Radio button value: {radio_value}")
        #     else:
        #         raise Exception(f"Radio button value doesn't start with SO_NO {SO_NO}")
                
        # except Exception as e:
        #     # Clean, simple error message regardless of the actual error type
        #     ERROR_MESSAGE = f"❌ Failed: S.O. number {SO_NO} not found"
        #     print(ERROR_MESSAGE)
        #     raise Exception(ERROR_MESSAGE)
        

        # # Step 13: Click on Place Vehicle button
        # print("🔍 Step 13: Looking for Place Vehicle button...")
        # try:
        #     place_vehicle_btn = WebDriverWait(driver, 10).until(
        #         EC.element_to_be_clickable((By.ID, "placeVehicleBtn"))
        #     )
        #     place_vehicle_btn.click()
        #     print("✅ Step 13: Clicked Place Vehicle button")
        # except Exception as e:
        #     ERROR_MESSAGE = f"❌ Could not find or click Place Vehicle button"
        #     print(ERROR_MESSAGE)
        #     raise Exception(ERROR_MESSAGE)
        
        # # Step: Check for refresh popup
        # print(f"🔍 Step: Checking for refresh popup...")
        # try:
        #     # Wait a moment for any popup to appear
        #     time.sleep(2)
            
        #     # Check for refresh popup
        #     try:
        #         # Wait for alert to be present (shorter timeout since it's optional)
        #         alert = WebDriverWait(driver, 3).until(EC.alert_is_present())
        #         alert_text = alert.text
        #         print(f"📱 Alert found: '{alert_text}'")
                
        #         # Check for the exact refresh popup message
        #         if "kindly refresh page once" in alert_text.lower():
        #             print("✅ Found 'kindly refresh page once' popup - clicking OK")
        #             alert.accept()  # Click OK
        #             print("✅ Clicked OK on refresh popup")

        #             print("🔍 Step 13 (AGAIN): Looking for Place Vehicle button...")
        #             try:
        #                 place_vehicle_btn = WebDriverWait(driver, 10).until(
        #                     EC.element_to_be_clickable((By.ID, "placeVehicleBtn"))
        #                 )
        #                 place_vehicle_btn.click()
        #                 print("✅ Step 13: Clicked Place Vehicle button")
        #             except Exception as e:
        #                 ERROR_MESSAGE = f"❌ Could not find or click Place Vehicle button by ID after refresh popup"
        #                 print(ERROR_MESSAGE)
        #                 raise Exception(ERROR_MESSAGE)


        #         else:
        #             print(f"⚠️ Found popup but not the expected refresh message: '{alert_text}'")
        #             alert.accept()  # Still accept it
        #             print("✅ Clicked OK on popup")
                    
        #     except:
        #         print("ℹ️ No refresh popup found - continuing with code")
            
        #     print("✅ Step completed: Refresh popup check done")
            
        # except Exception as e:
        #     ERROR_MESSAGE = f"❌ Could not handle refresh popup"
        #     print(ERROR_MESSAGE)
        #     raise Exception(ERROR_MESSAGE)
        

        
        # # Step 14: Type full vehicle number character by character
        # print(f"🔍 Step 14: Looking for vehicle number input field...")
        # try:
        #     # Wait for vehicle input field to be clickable
        #     vehicle_input = WebDriverWait(driver, 10).until(
        #         EC.element_to_be_clickable((By.ID, "vehicle_noo"))
        #     )
            
        #     # Prepare the vehicle number string
        #     vehicle_num_str = str(VEHICLE_NUM)
        #     print(f"    Vehicle number: '{vehicle_num_str}'")
            
        #     vehicle_found = False
            
        #     # Clear the input field
        #     vehicle_input.clear()
        #     time.sleep(0.5)
            
        #     # Type the full vehicle number character by character
        #     print(f"    Typing vehicle number '{vehicle_num_str}' character by character...")
        #     for i, char in enumerate(vehicle_num_str):
        #         vehicle_input.send_keys(char)
        #         print(f"    Typed character {i+1}: '{char}' (Progress: {''.join(vehicle_num_str[:i+1])})")
        #         time.sleep(0.3)  # Small delay between characters
            
        #     # Wait for autocomplete to load after typing complete number
        #     print("    Waiting for autocomplete dropdown to appear...")
        #     time.sleep(2)

        #     # Look for dropdown options
        #     try:
        #         # Find the autocomplete container
        #         print("⏳ Looking for autocomplete dropdown...")
        #         autocomplete_container = WebDriverWait(driver, 10).until(
        #             EC.presence_of_element_located((By.ID, "vehicle_nooautocomplete-list"))
        #         )
        #         print("    ✅ Found autocomplete container.")

        #         # Find all available options within the container
        #         dropdown_options = autocomplete_container.find_elements(By.XPATH, ".//div[input[@type='hidden']]")
        #         print(f"    Found {len(dropdown_options)} options in dropdown.")

        #         if not dropdown_options:
        #             raise Exception("Autocomplete container appeared, but it's empty.")

        #         # Check each dropdown option for a match
        #         for i, option in enumerate(dropdown_options):
        #             option_text = option.text.strip()
        #             print(f"    Checking option {i+1}: '{option_text}'")
                    
        #             if vehicle_num_str in option_text:
        #                 print(f"    ✅ Found match! Clicking option '{option_text}'...")
        #                 driver.execute_script("arguments[0].click();", option)
        #                 vehicle_found = True
        #                 break # Exit loop once found
                
        #     except Exception as e:
        #         print(f"    ❌ Error: Autocomplete dropdown did not appear or was not usable: {e}")
        #         raise Exception(f"Error finding/using dropdown: {str(e)}")
            
        #     if not vehicle_found:
        #         raise Exception(f"No matching vehicle number '{vehicle_num_str}' found in dropdown options")
            
        #     # Final verification
        #     final_value = vehicle_input.get_attribute("value")
        #     print(f"✅ Step 14 completed: Final vehicle value: '{final_value}'")
                
        # except Exception as e:
        #     ERROR_MESSAGE = f"❌ Vehicle number '{VEHICLE_NUM}' not found or field was inaccessible."
        #     print(ERROR_MESSAGE)
        #     raise Exception(ERROR_MESSAGE)


        # # Step 15: Enhanced driver name handling (handles both manual selection and auto-fill)
        # print(f"🔍 Step 15: Looking for driver license input field...")
        # try:
        #     # Wait for driver input field to be present
        #     driver_input = WebDriverWait(driver, 10).until(
        #         EC.presence_of_element_located((By.ID, "driverLicId"))
        #     )
            
        #     # Check if the field is readonly (auto-filled)
        #     is_readonly = driver_input.get_attribute("readonly")
        #     current_value = driver_input.get_attribute("value")
            
        #     print(f"   Driver input field status:")
        #     print(f"   - Is readonly: {is_readonly is not None}")
        #     print(f"   - Current value: '{current_value}'")
            
        #     if is_readonly is not None and current_value:
        #         # Field is auto-filled and readonly
        #         print(f"✅ Step 15: Driver field is auto-filled with: '{current_value}'")
                
        #         # Extract license number from the auto-filled value if it contains our LICENSE_NUM
        #         license_num_str = str(LICENSE_NUM)
                
        #         if license_num_str in current_value:
        #             print(f"✅ Auto-filled driver contains our LICENSE_NUM '{license_num_str}'")
        #             print(f"✅ Step 15: Using auto-filled driver: '{current_value}'")
        #         else:
        #             print(f"⚠️ Auto-filled driver '{current_value}' doesn't contain LICENSE_NUM '{license_num_str}'")
        #             print(f"⚠️ Step 15: Proceeding with auto-filled driver anyway")
                
        #         # No need to do anything else - the field is already filled
        #         driver_found = True
                
        #     else:
        #         # Field is not auto-filled, proceed with manual selection
        #         print("   Driver field is not auto-filled, proceeding with manual selection...")
                
        #         # Make sure the field is clickable for manual input
        #         driver_input = WebDriverWait(driver, 10).until(
        #             EC.element_to_be_clickable((By.ID, "driverLicId"))
        #         )
                
        #         # Tokenize DRIVER_NAME into words
        #         driver_words = DRIVER_NAME.strip().split()
        #         print(f"   Driver name words: {driver_words}")
                
        #         driver_found = False
                
        #         # Try each word in DRIVER_NAME
        #         for word_index, word in enumerate(driver_words):
        #             if driver_found:
        #                 break
                        
        #             print(f"   Trying word {word_index + 1}: '{word}'")
                    
        #             # Clear the input field
        #             driver_input.clear()
        #             time.sleep(0.5)
                    
        #             # Type first 3 letters of the word one by one
        #             first_three = word[:3].upper()
        #             print(f"   Typing first 3 letters: '{first_three}'")
                    
        #             for char in first_three:
        #                 driver_input.send_keys(char)
        #                 time.sleep(0.3)  # Small delay between characters
                    
        #             # Look for dropdown options using the correct HTML structure
        #             try:
        #                 # Find autocomplete container
        #                 autocomplete_container = None
        #                 dropdown_options = []
                        
        #                 # Try to find the dropdown
        #                 selectors_to_try = [
        #                     (By.ID, "driverLicIdautocomplete-list")
        #                 ]
                        
        #                 for method_num, (by_type, selector) in enumerate(selectors_to_try, 1):
        #                     try:
        #                         print(f"   Trying method {method_num}: {by_type} = '{selector}'")
        #                         autocomplete_container = WebDriverWait(driver, 3).until(
        #                             EC.presence_of_element_located((by_type, selector))
        #                         )
        #                         print(f"   ✅ Found autocomplete container using method {method_num}")
        #                         break
        #                     except:
        #                         print(f"   Method {method_num} failed")
        #                         continue
                        
        #                 if autocomplete_container:
        #                     # Find dropdown options within the container
        #                     option_selectors = [
        #                         ".//div[input[@type='hidden']]"
        #                     ]
                            
        #                     for opt_method, opt_selector in enumerate(option_selectors, 1):
        #                         try:
        #                             dropdown_options = autocomplete_container.find_elements(By.XPATH, opt_selector)
        #                             if dropdown_options:
        #                                 print(f"   ✅ Found {len(dropdown_options)} options using option method {opt_method}")
        #                                 break
        #                             else:
        #                                 print(f"   Option method {opt_method} found 0 options")
        #                         except Exception as e:
        #                             ERROR_MESSAGE = f"❌ Error finding options with method {opt_method}"
        #                             print(f"   Option method {opt_method} failed")
                        
        #                 print(f"   Final result: Found {len(dropdown_options)} dropdown options")
                        
        #                 if not dropdown_options:
        #                     print(f"   No dropdown options found for word '{word}'")
        #                     continue
                        
        #                 # Check each dropdown option for LICENSE_NUM match
        #                 for i, option in enumerate(dropdown_options):
        #                     try:
        #                         option_text = option.text.strip()
        #                         print(f"   Option {i+1}: '{option_text}'")
                                
        #                         # Extract license number from option text (format: "NAME-LICENSE_NUMBER")
        #                         if '-' in option_text:
        #                             license_full = option_text.split('-')[-1].strip()
                                    
        #                             # Get last 4 digits of the license number
        #                             if len(license_full) >= 4:
        #                                 last_4_digits = license_full[-4:]
        #                                 license_num_str = str(LICENSE_NUM)
                                        
        #                                 print(f"   License full: '{license_full}', Last 4 digits: '{last_4_digits}', Looking for: '{license_num_str}'")
                                        
        #                                 # Check if LICENSE_NUM matches exactly the last 4 digits
        #                                 if last_4_digits == license_num_str:
        #                                     print(f"   ✅ Found exact match! Last 4 digits '{last_4_digits}' == LICENSE_NUM '{license_num_str}'")
        #                                     print(f"   Selected option: '{option_text}'")
                                            
        #                                     # Click the matching option
        #                                     driver.execute_script("arguments[0].click();", option)
        #                                     driver_found = True
        #                                     break
        #                                 else:
        #                                     print(f"   No match: '{last_4_digits}' != '{license_num_str}'")
        #                             else:
        #                                 print(f"   License too short: '{license_full}'")
        #                         else:
        #                             print(f"   No dash found in option text")
                                    
        #                     except Exception as e:
        #                         ERROR_MESSAGE = f"❌ Error reading option {i+1}"
        #                         print(f"   Error reading option {i+1}")
        #                         continue
                        
        #                 if driver_found:
        #                     print(f"✅ Step 15: Successfully selected driver from dropdown")
        #                     break
        #                 else:
        #                     print(f"   No matching LICENSE_NUM found for word '{word}'")
                            
        #             except Exception as e:
        #                 ERROR_MESSAGE = f"❌ Error looking for autocomplete dropdown"
        #                 print(f"   Error looking for autocomplete dropdown")
        #                 continue
            
        #     if not driver_found and not (is_readonly is not None and current_value):
        #         ERROR_MESSAGE = f"Driver with LICENSE_NUM {LICENSE_NUM} not found in dropdown"
        #         print(f"❌ Step 15: Could not find driver with LICENSE_NUM {LICENSE_NUM} in any dropdown")
        #         raise Exception(ERROR_MESSAGE)
            
        #     # Final verification - read the final value in the field
        #     final_value = driver_input.get_attribute("value")
        #     print(f"✅ Step 15 completed: Final driver value: '{final_value}'")
                
        
        # except Exception as e:
        #     ERROR_MESSAGE = f"❌ Could not find driver"
        #     print(f"❌ Step 15: Error in driver selection process")
        #     raise Exception(ERROR_MESSAGE)

        # # Step 16: Enhanced mobile number handling
        # print(f"🔍 Step 16: Looking for mobile number input field...")
        # try:
        #     mobile_input = WebDriverWait(driver, 10).until(
        #         EC.presence_of_element_located((By.ID, "mobile_no"))
        #     )
            
        #     # Check if field is readonly (auto-filled)
        #     is_readonly = mobile_input.get_attribute("readonly")
        #     current_value = mobile_input.get_attribute("value")
            
        #     if is_readonly is not None and current_value:
        #         # Field is auto-filled - use existing value
        #         print(f"✅ Step 16: Using auto-filled mobile number: '{current_value}'")
        #     else:
        #         # Field is empty - input manually
        #         mobile_input = WebDriverWait(driver, 10).until(
        #             EC.element_to_be_clickable((By.ID, "mobile_no"))
        #         )
        #         mobile_input.clear()
        #         mobile_input.send_keys(str(PHONE_NUMBER))
        #         print(f"✅ Step 16: Entered mobile number: {PHONE_NUMBER}")
            
        #     print(f"✅ Step 16 completed")
                
        # except Exception as e:
        #     ERROR_MESSAGE = f"❌ Could not find or input mobile number"
        #     print(f"❌ Step 16: Mobile number input failed: {e}")
        #     raise Exception(ERROR_MESSAGE)
        

        # # Step 17: Input quantity with validation
        # print(f"🔍 Step 17: Looking for qty input field...")
        # try:
        #     # Wait for element to be clickable (interactable)

        #     # Get the text content from the labels and convert to float
        #     WEIGHT = float(WEIGHT)
        #     rem_veh_cc_text = driver.find_element(By.ID, "remVehCC").text
        #     rem_veh_cc = float(rem_veh_cc_text)
        #     print(f"Remaining Vehicle CC: {rem_veh_cc}")

        #     rem_qty_text = driver.find_element(By.ID, "remQty").text
        #     rem_qty = float(rem_qty_text)
        #     print(f"Remaining Qty: {rem_qty}") 

        #     # Check if both rem_qty and rem_veh_cc are >= (WEIGHT-5)
        #     weight_threshold = WEIGHT - 5
        #     print(f"Weight threshold (WEIGHT-5): {weight_threshold}")

            
        #     if rem_qty >= weight_threshold and rem_veh_cc >= weight_threshold:
        #         # Find the smallest of the three values - no rounding
        #         smallest_value = min(rem_qty, rem_veh_cc, WEIGHT)
        #         input_value = smallest_value  # Use exact decimal value
        #         ACTUAL_QUANTITY = input_value  # Store for response
                
        #         print(f"✅ Condition met: Both remaining values >= {weight_threshold}")
        #         print(f"Smallest value among ({rem_qty}, {rem_veh_cc}, {WEIGHT}): {smallest_value}")
        #         print(f"Input value: {input_value}")
        #         print(f"Actual quantity for AP: {ACTUAL_QUANTITY}")
                
        #         qty_input = WebDriverWait(driver, 10).until(
        #             EC.element_to_be_clickable((By.ID, "qty"))
        #         )
                
        #         qty_input.send_keys(str(input_value))
        #         print(f"✅ Step 17: Entered Qty: {input_value}")
        #     else:
        #         print(f"❌ Condition not met:")
        #         print(f"   rem_qty ({rem_qty}) >= {weight_threshold}: {rem_qty >= weight_threshold}")
        #         print(f"   rem_veh_cc ({rem_veh_cc}) >= {weight_threshold}: {rem_veh_cc >= weight_threshold}")
        #         ACTUAL_QUANTITY = None  # No quantity was processed
        #         raise Exception(f"Step 17 failed: Insufficient remaining quantity or vehicle CC")
                
        
        # except Exception as e:
        #     ERROR_MESSAGE = f"❌ Could not input quantity"
        #     print(f"❌ Step 17: Could not find or input quantity: {e}")
        #     # Set fallback actual quantity to requested weight if not set
        #     if ACTUAL_QUANTITY is None:
        #         ACTUAL_QUANTITY = WEIGHT
        #     raise Exception(ERROR_MESSAGE)        

        # #interim step:

        # try:
        #     ETA = WebDriverWait(driver, 10).until(
        #         EC.element_to_be_clickable((By.ID, "ETADateTime"))
        #         )
        #     ETA.click()
        #     print("✅ Clicked ETA button")
        #     # Remove focus immediately after clicking
        #     # Click on the body element to remove focus
        #     body = driver.find_element(By.TAG_NAME, "body")
        #     body.click()
        #     print("✅ Clicked body to remove focus from ETA")
        # except Exception as e:
        #     ERROR_MESSAGE = f"❌ Could not find or click eta button"
        #     print(f"❌  Could not find or click eta button: {e}")

        # try:
        #     driver.save_screenshot("details.png")
        #     print("📸 Details screenshot saved as 'details.png'")
        # except:
        #     pass
        

        # # Step 18: Click on submit button 1
        # print("🔍 Step 18: Looking for submit button 1...")
        # try:
        #     submit_btn1 = WebDriverWait(driver, 10).until(
        #         EC.element_to_be_clickable((By.ID, "placeVehicleSubmit"))
        #     )
        #     submit_btn1.click()
        #     print("✅ Step 18: Clicked 1st submit button")
            
        #     # Check for any popup that might appear after clicking submit button 1
        #     print("🔍 Step 18: Checking for popup after clicking submit button 1...")
        #     # Wait a moment for popup to appear
        #     time.sleep(2)
            
        #     # Check for alert/popup
        #     try:
        #         alert = WebDriverWait(driver, 3).until(EC.alert_is_present())
        #         alert_text = alert.text.strip()
        #         print(f"📱 Popup found after submit button 1: '{alert_text}'")
                
        #         # Take screenshot BEFORE raising exception (while popup is visible)
        #         try:
        #             error_ss_path = "/home/ubuntu/whatsapp-bot/error_ss.png"
        #             os.makedirs(os.path.dirname(error_ss_path), exist_ok=True)
        #             driver.save_screenshot(error_ss_path)
        #             print(f"📸 Error screenshot saved as '{error_ss_path}' with popup visible")
        #         except Exception as ss_err:
        #             print(f"⚠️ Could not take error screenshot: {ss_err}")
                
        #         # DON'T accept the alert - leave it for the screenshot
        #         # alert.accept()
                
        #         # Any popup after submit button 1 is an error - throw it directly
        #         ERROR_MESSAGE = f"❌ Error after clicking submit button 1: {alert_text}"
        #         print(ERROR_MESSAGE)
        #         raise Exception(ERROR_MESSAGE)
                
        #     except Exception as alert_exception:
        #         # Check if this is our custom popup error
        #         if "Error after clicking submit button 1:" in str(alert_exception):
        #             # This is our popup error - re-raise it to stop execution
        #             raise alert_exception
        #         else:
        #             # No popup found - this is normal, continue
        #             print("ℹ️ No popup found after clicking submit button 1 - continuing normally")
                
        # except Exception as e:
        #     # Check if this is our custom error from popup handling
        #     if "Error after clicking submit button 1:" in str(e):
        #         raise e  # Re-raise the popup error as-is
        #     else:
        #         ERROR_MESSAGE = f"❌ Could not find or click 1st submit button for placing vehicle"
        #         print(f"❌ Step 18: Could not find or click 1st submit button: {e}")
        #         raise Exception(ERROR_MESSAGE)
        
        # #step 19:
        # print("🔍 Step 19: Looking for submit button 2...")
        # try:
        #     submit_btn2 = WebDriverWait(driver, 10).until(
        #         EC.element_to_be_clickable((By.ID, "sublitLRDetails"))
        #     )
        #     submit_btn2.click()
        #     print("✅ Step 19: Clicked 2nd submit button")
        # except Exception as e:
        #     ERROR_MESSAGE = f"❌ Could not find or click 2nd submit button for placing vehicle"
        #     print(f"❌ Step 19: Could not find or click 2nd submit button: {e}")
        #     raise Exception(ERROR_MESSAGE)
        

        # # Step 20: Handle JS popup confirmation
        # print(f"🔍 Step: Looking for confirmation popup...")
        # try:
        #     # Wait a moment for popup to appear
        #     time.sleep(2)
            
        #     # Check for the specific confirmation popup
        #     try:
        #         # Wait for alert to be present
        #         alert = WebDriverWait(driver, 5).until(EC.alert_is_present())
        #         alert_text = alert.text
        #         print(f"📱 Alert found: '{alert_text}'")
                
        #         # Check if it's the expected confirmation message
        #         if "Confirm to Allocate Vehicle For This Order" in alert_text:
        #             print("✅ Found expected confirmation popup")
        #             alert.accept()  # Click OK
        #             print("✅ Clicked OK on confirmation popup")
        #         else:
        #             print(f"⚠️ Unexpected alert message: '{alert_text}'")
        #             alert.accept()  # Still accept it
        #             print("✅ Clicked OK on unexpected alert")
                    
        #     except:
        #         print("❌ No confirmation popup found")
        #         raise Exception("Expected confirmation popup not found")
            
            
        #     print("✅ Step completed: Confirmation popup handled successfully")
            
        # except Exception as e:
        #     ERROR_MESSAGE = f"❌ Could not handle final confirmation popup"
        #     print(f"❌ Step failed: Could not handle confirmation popup: {e}")
        #     raise Exception(ERROR_MESSAGE)
        




        # Final status check
        time.sleep(2)
        print("🔎 Final URL:", driver.current_url)
        print("🏁 All steps completed successfully")

        # Always quit the driver when done
        driver.quit()
        
        # Clean up temp directory
        if HEADLESS and 'temp_dir' in locals():
            import shutil
            try:
                shutil.rmtree(temp_dir)
            except:
                pass

        # Success - send success response
        processed_result = {
            'status': 'success',
            'message': 'Data processed successfully',
            'processed_data': {
                'driver_name': DRIVER_NAME,
                'driver_license': LICENSE_NUM,
                'vehicle_num': VEHICLE_NUM,
                'destination': DESTINATION,
                'weight': WEIGHT,
                'actual_quantity': ACTUAL_QUANTITY if ACTUAL_QUANTITY is not None else WEIGHT,  # Include actual quantity used or fallback to requested
                'so_no': SO_NO,
                'phone_num': PHONE_NUMBER
            }
        }
        return jsonify(processed_result)

        
        
    except Exception as e:
        # 1. CAPTURE THE ERROR SCREENSHOT
        # We do this first because driver.quit() would destroy the window
        if 'driver' in locals() and driver is not None:
            try:
                print("📸 Error detected! Attempting to save screenshot...")
                # Save to the path that JavaScript expects
                error_ss_path = "/home/ubuntu/whatsapp-bot/error_ss.png"
                
                # Create directory if it doesn't exist
                os.makedirs(os.path.dirname(error_ss_path), exist_ok=True)
                
                driver.save_screenshot(error_ss_path)
                print(f"✅ Screenshot saved as '{error_ss_path}'")
            except Exception as ss_err:
                print(f"⚠️ Could not take screenshot: {ss_err}")

        # 2. CLEAN UP THE BROWSER (CRITICAL)
        if 'driver' in locals() and driver is not None:
            try:
                driver.quit()
                print("🛑 Chrome driver closed.")
            except:
                pass

        # 3. CLEAN UP THE TEMP DIRECTORY
        if 'temp_dir' in locals() and temp_dir is not None:
            try:
                import shutil
                if os.path.exists(temp_dir):
                    shutil.rmtree(temp_dir)
                    print("🧹 Temp directory cleaned.")
            except:
                pass

        # 4. SEND THE FINAL ERROR REPORT
        # This uses the message from your 'raise' in Step 14 or 17
        print(f"❌ Final Error: {str(e)}")
        traceback.print_exc()
        
        return jsonify({
            'status': 'error',
            'message': str(e),
            'processed_data': None
        }), 500
if __name__ == '__main__':
    print("Python server starting...")
    app.run(host='0.0.0.0', port=5000, debug=True)
