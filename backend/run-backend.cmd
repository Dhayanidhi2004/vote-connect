@echo off
set DATABASE_URL=sqlite:///./cyep.db
"C:\Users\Siva\AppData\Local\Programs\Python\Python313\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8001
