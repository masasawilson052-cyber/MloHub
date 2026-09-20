@echo off
set OUTDIR=C:\Users\hp\Downloads\MloHub_Expo 2\MloHub_Expo\docs\design-references\pack5a-after

echo [1/19] 01_app_icon.png
copy /Y "C:\Users\hp\Downloads\MloHub_Expo 2\MloHub_Expo\assets\icon.png" "%OUTDIR%\01_app_icon.png"

echo [2/19] 02_splash_screen.png
call "scripts\snap.bat" "%OUTDIR%\02_splash_screen.png" "http://127.0.0.1:8089/splash.html"

echo [3/19] 03_onboarding_1_discover.png
call "scripts\snap.bat" "%OUTDIR%\03_onboarding_1_discover.png" "http://127.0.0.1:8089/onboarding?slide=0"

echo [4/19] 04_onboarding_2_compare.png
call "scripts\snap.bat" "%OUTDIR%\04_onboarding_2_compare.png" "http://127.0.0.1:8089/onboarding?slide=1"

echo [5/19] 05_onboarding_3_happier_moments.png
call "scripts\snap.bat" "%OUTDIR%\05_onboarding_3_happier_moments.png" "http://127.0.0.1:8089/onboarding?slide=2"

echo [6/19] 06_welcome_entry.png
call "scripts\snap.bat" "%OUTDIR%\06_welcome_entry.png" "http://127.0.0.1:8089/auth"

echo [7/19] 07_sign_up.png
call "scripts\snap.bat" "%OUTDIR%\07_sign_up.png" "http://127.0.0.1:8089/auth/register-customer"

echo [8/19] 08_sign_in.png
call "scripts\snap.bat" "%OUTDIR%\08_sign_in.png" "http://127.0.0.1:8089/auth/login"

echo [9/19] 09_explore_home.png
call "scripts\snap.bat" "%OUTDIR%\09_explore_home.png" "http://127.0.0.1:8089/(tabs)"

echo [10/19] 10_restaurant_details.png
call "scripts\snap.bat" "%OUTDIR%\10_restaurant_details.png" "http://127.0.0.1:8089/restaurant/rest-swahili-dar"

echo [11/19] 11_dish_details.png
call "scripts\snap.bat" "%OUTDIR%\11_dish_details.png" "http://127.0.0.1:8089/restaurant/rest-swahili-dar?highlightDishId=dish-pilau-1"

echo [12/19] 12_cart_checkout.png
call "scripts\snap.bat" "%OUTDIR%\12_cart_checkout.png" "http://127.0.0.1:8089/restaurant/rest-swahili-dar"

echo [13/19] 13_custom_meal_request.png
call "scripts\snap.bat" "%OUTDIR%\13_custom_meal_request.png" "http://127.0.0.1:8089/(tabs)/custom"

echo [14/19] 14_orders.png
call "scripts\snap.bat" "%OUTDIR%\14_orders.png" "http://127.0.0.1:8089/(tabs)/orders"

echo [15/19] 15_bookings.png
call "scripts\snap.bat" "%OUTDIR%\15_bookings.png" "http://127.0.0.1:8089/(tabs)/bookings"

echo [16/19] 16_profile.png
call "scripts\snap.bat" "%OUTDIR%\16_profile.png" "http://127.0.0.1:8089/(tabs)/profile"

echo [17/19] 17_language_selection.png
call "scripts\snap.bat" "%OUTDIR%\17_language_selection.png" "http://127.0.0.1:8089/(tabs)/profile?showLanguage=true"

echo [18/19] 18_empty_state.png
call "scripts\snap.bat" "%OUTDIR%\18_empty_state.png" "http://127.0.0.1:8089/empty_state.html"

echo [19/19] 19_error_offline_state.png
call "scripts\snap.bat" "%OUTDIR%\19_error_offline_state.png" "http://127.0.0.1:8089/error_offline.html"

echo ALL SCREENSHOTS CAPTURED SUCCESSFULLY.
