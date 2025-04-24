import pyautogui
import time
import logging

# --- Configuration ---
INTERVAL_SECONDS = 300
  # 5 minutes (5 * 60 seconds)
TEXT_TO_TYPE = "continue with application testing. Implement tests if necessarz. Do not change functionalitz. Make app fullz functional. Feel free to use browsermcp for trzing out the app."
DELAY_AFTER_CLICK = 0.5  # Seconds after click before typing
DELAY_AFTER_TYPE = 0.5   # Seconds after typing before Enter

# --- Setup Logging ---
log_format = '%(asctime)s - %(levelname)s - %(message)s'
logging.basicConfig(level=logging.INFO, format=log_format)
logger = logging.getLogger(__name__)

logger.info("--- Keep Cursor Agent Alive Script Started ---")
logger.info(f"Typing '{TEXT_TO_TYPE}' every {INTERVAL_SECONDS}s.")
logger.info("Press Ctrl+C in terminal to stop.")

try:
    while True:
        # Wait for the specified interval
        logger.info(f"Waiting {INTERVAL_SECONDS} seconds...")
        time.sleep(INTERVAL_SECONDS)

        try:
            # Click at the current cursor position
            logger.info("Clicking...")
            pyautogui.click()
            time.sleep(DELAY_AFTER_CLICK)

            # Type the text
            logger.info(f"Typing: '{TEXT_TO_TYPE}'")
            pyautogui.write(TEXT_TO_TYPE, interval=0.05)  # Add small interval
            time.sleep(DELAY_AFTER_TYPE)

            # Press Enter
            logger.info("Pressing Enter.")
            pyautogui.press('enter')

            logger.info("Action sequence done.")

        except pyautogui.FailSafeException:
            logger.error("Fail-safe triggered (mouse corner?). Stopping.")
            break
        except Exception as e:
            logger.error(f"Action sequence error: {e}")
            # Decide if you want to continue or stop on error
            # break # Uncomment to stop on error

except KeyboardInterrupt:
    logger.info("Ctrl+C detected. Stopping script gracefully.")
finally:
    logger.info("--- Keep Cursor Agent Alive Script Finished ---") 