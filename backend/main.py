# File: main.py

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import date
import sqlite3
import uvicorn
import pandas as pd
from collections import defaultdict
import numpy as np

app = FastAPI()

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Database ---
DB_NAME = "portfolio.db"
POSITIONS_EXCEL_FILE = "//Users/abhisheksingh/Library/CloudStorage/OneDrive-Personal/mfarm/factor9.xlsx"

def init_db():
    with sqlite3.connect(DB_NAME) as conn:
        c = conn.cursor()
        # IMPORTANT: Uncomment this line and DELETE your existing portfolio.db
        # file if you want to ensure a clean database with any previous schema changes.
        # c.execute("DROP TABLE IF EXISTS positions")
        c.execute("""
            CREATE TABLE IF NOT EXISTS positions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT,
                symbol TEXT,
                sector TEXT,
                buy_date TEXT,
                sell_date TEXT,
                buy_price REAL,
                sell_price REAL,
                qty INTEGER,
                type TEXT,
                note TEXT,
                strategy TEXT,
                tradevalue REAL,
                market_value REAL,
                total_pnl REAL,
                pct_pnl REAL,
                tvm REAL, -- Changed to REAL for numeric storage
                pos_age TEXT
            )
        """)
        conn.commit()

init_db()

_raw_excel_data = []

def load_raw_excel_data():
    """Loads all raw data from the Excel file."""
    global _raw_excel_data
    print(f"Attempting to load data from: {POSITIONS_EXCEL_FILE}")
    try:
        df = pd.read_excel(POSITIONS_EXCEL_FILE)
        print(f"Excel file '{POSITIONS_EXCEL_FILE}' read successfully.")
        print("Original Columns:", df.columns.tolist())

        df.columns = df.columns.str.lower()
        print("Lowercased Columns:", df.columns.tolist())

        df['symbol'] = df['symbol'].astype(str).str.upper().str.strip()
        df['buy_date'] = pd.to_datetime(df['buy_date'], errors='coerce').dt.strftime('%Y-%m-%d')
        df['qty'] = pd.to_numeric(df['qty'], errors='coerce').fillna(0).astype(int)

        numeric_cols = [
            'current_price', 'avg_price', 'delta', 'daily_change', 'daily_pnl',
            'tradevalue', 'market_value', 'total_pnl', 'pct_pnl', 'weight_tv', 'weight_mv', 'tvm' # Added tvm here
        ]
        for col in numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce')
                df[col] = df[col].fillna(0.0) # Ensure 0.0 for floats
            else:
                df[col] = 0.0 # Default to 0.0 if column doesn't exist

        _raw_excel_data = df.to_dict(orient='records')
        print(f"Raw Excel data loaded into memory: {len(_raw_excel_data)} records.")

    except FileNotFoundError:
        print(f"ERROR: {POSITIONS_EXCEL_FILE} not found. Ensure the Excel file exists in the same directory as main.py.")
        _raw_excel_data = []
    except Exception as e:
        print(f"CRITICAL ERROR during load_raw_excel_data: {type(e).__name__}: {e}")
        _raw_excel_data = []

load_raw_excel_data()

# --- Schema ---
class TradeInput(BaseModel):
    symbol: str = Field(..., min_length=1, pattern=r"^[a-zA-Z0-9]+$")
    ticker: Optional[str] = None # Make ticker optional as it's less critical now
    buy_price: float
    qty: int
    sector: Optional[str] = None
    buy_date: Optional[date] = None
    sell_date: Optional[date] = None
    sell_price: Optional[float] = None
    type: Optional[str] = None
    note: Optional[str] = None
    strategy: Optional[str] = None

    @validator("symbol")
    def uppercase_symbol(cls, v):
        return v.strip().upper()

    class Config:
        extra = "ignore"

class SellTradeRecord(BaseModel):
    symbol: str
    ticker: Optional[str] = None
    buy_date: date
    buy_price: float
    qty: int
    sell_date: date
    sell_price: float
    sector: Optional[str] = None
    note: Optional[str] = "Sold from Open Positions (Excel Source)"
    tradevalue: Optional[float] = None
    market_value: Optional[float] = None
    total_pnl: Optional[float] = None
    pct_pnl: Optional[float] = None
    tvm: Optional[float] = None # Changed to float
    pos_age: Optional[str] = None


# --- Endpoints ---

@app.post("/positions")
async def add_position(trade: TradeInput):
    try:
        with sqlite3.connect(DB_NAME) as conn:
            c = conn.cursor()
            c.execute("""
                INSERT INTO positions (
                    ticker, symbol, sector, buy_date, sell_date,
                    buy_price, sell_price, qty, type, note, strategy
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                trade.ticker,
                trade.symbol,
                trade.sector,
                trade.buy_date.isoformat() if trade.buy_date else None,
                trade.sell_date.isoformat() if trade.sell_date else None,
                round(trade.buy_price, 2),
                round(trade.sell_price, 2) if trade.sell_price is not None else None,
                trade.qty,
                trade.type,
                trade.note,
                trade.strategy
            ))
            conn.commit()
        return {"status": "success", "id": c.lastrowid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/positions/{position_id}")
async def update_position(position_id: int, trade: TradeInput):
    try:
        with sqlite3.connect(DB_NAME) as conn:
            c = conn.cursor()
            c.execute("""
                UPDATE positions
                SET ticker = ?, symbol = ?, sector = ?, buy_date = ?, sell_date = ?,
                    buy_price = ?, sell_price = ?, qty = ?, type = ?, note = ?, strategy = ?
                WHERE id = ?
            """, (
                trade.ticker,
                trade.symbol,
                trade.sector,
                trade.buy_date.isoformat() if trade.buy_date else None,
                trade.sell_date.isoformat() if trade.sell_date else None,
                round(trade.buy_price, 2),
                round(trade.sell_price, 2) if trade.sell_price is not None else None,
                trade.qty,
                trade.type,
                trade.note,
                trade.strategy,
                position_id
            ))
            conn.commit()
            if c.rowcount == 0:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Position not found")
        return {"status": "updated"}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/sell_trade")
async def record_sell_trade(sell_record: SellTradeRecord):
    try:
        with sqlite3.connect(DB_NAME) as conn:
            c = conn.cursor()
            c.execute("""
                INSERT INTO positions (
                    ticker, symbol, sector, buy_date, sell_date,
                    buy_price, sell_price, qty, type, note,
                    tradevalue, market_value, total_pnl, pct_pnl, tvm, pos_age
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                sell_record.ticker,
                sell_record.symbol,
                sell_record.sector,
                sell_record.buy_date.isoformat(),
                sell_record.sell_date.isoformat(),
                round(sell_record.buy_price, 2),
                round(sell_record.sell_price, 2),
                0,
                "SELL",
                sell_record.note,
                round(sell_record.tradevalue, 2) if sell_record.tradevalue is not None else None,
                round(sell_record.market_value, 2) if sell_record.market_value is not None else None,
                round(sell_record.total_pnl, 2) if sell_record.total_pnl is not None else None,
                round(sell_record.pct_pnl, 2) if sell_record.pct_pnl is not None else None,
                round(sell_record.tvm, 2) if sell_record.tvm is not None else None, # Rounded tvm
                sell_record.pos_age
            ))
            conn.commit()
        return {"status": "sell trade recorded successfully", "id": c.lastrowid}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/simulate")
async def simulate_trade(trade: TradeInput):
    try:
        if not trade.symbol:
            raise HTTPException(status_code=400, detail="Symbol is required for simulation")

        existing_qty = 0
        existing_cost = 0.0

        with sqlite3.connect(DB_NAME) as conn:
            conn.row_factory = sqlite3.Row
            c = conn.cursor()
            c.execute("""
                SELECT qty, buy_price FROM positions
                WHERE symbol = ? AND sell_date IS NULL AND qty > 0
            """, (trade.symbol,))
            for row in c.fetchall():
                existing_qty += row["qty"]
                existing_cost += row["qty"] * row["buy_price"]

        new_qty = trade.qty
        new_cost = trade.qty * trade.buy_price

        total_qty = existing_qty + new_qty
        total_cost = existing_cost + new_cost

        avg_price = round(total_cost / total_qty, 2) if total_qty else 0

        return {
            "simulated_avg_price": avg_price,
            "simulated_qty": total_qty
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/positions")
async def get_open_positions():
    print("GET /positions endpoint called.")
    if not _raw_excel_data:
        print("Raw Excel data is empty. Attempting to reload.")
        load_raw_excel_data()
        if not _raw_excel_data:
            print("ERROR: Excel data could not be loaded into _raw_excel_data. Returning 500.")
            raise HTTPException(status_code=500, detail="Failed to load Excel data. Check server logs.")

    grouped_by_symbol = defaultdict(lambda: {
        "symbol": "",
        "totalQty": 0,
        "totalCost": 0.0,
        "currentPrice": 0.0,
        "sector": "",
        "daily_change": 0.0,
        "daily_pnl": 0.0,
        "tradevalue": 0.0,
        "market_value": 0.0,
        "total_pnl": 0.0,
        "pct_pnl": 0.0,
        "pos_age": "",
        "account": "",
        "tvm": 0.0, # Default to 0.0 for tvm
        "buy_date_first": None,
        "avg_price_excel": 0.0,
        "ticker": ""
    })

    print(f"Processing {len(_raw_excel_data)} raw Excel entries for grouping.")
    for row in _raw_excel_data:
        try:
            sym = row.get('symbol', '').upper()
            qty = row.get('qty', 0)
            ticker_from_excel = str(row.get('ticker', '')) if not pd.isna(row.get('ticker')) else ""

            for k in [
                'current_price', 'avg_price', 'delta', 'daily_change', 'daily_pnl',
                'tradevalue', 'market_value', 'total_pnl', 'pct_pnl', 'weight_tv', 'weight_mv', 'tvm' # tvm added here
            ]:
                if pd.isna(row.get(k)):
                    row[k] = 0.0
                else:
                    row[k] = float(row[k])

            for k in ['sector', 'pos_age', 'account']: # tvm removed as it's numeric now
                if pd.isna(row.get(k)):
                    row[k] = ""

            if sym and qty > 0:
                if grouped_by_symbol[sym]["totalQty"] == 0:
                    grouped_by_symbol[sym]["symbol"] = sym
                    grouped_by_symbol[sym]["ticker"] = ticker_from_excel
                    grouped_by_symbol[sym]["sector"] = row.get('sector', '')
                    grouped_by_symbol[sym]["currentPrice"] = row.get('current_price', 0.0)
                    grouped_by_symbol[sym]["daily_change"] = row.get('daily_change', 0.0)
                    grouped_by_symbol[sym]["daily_pnl"] = row.get('daily_pnl', 0.0)
                    grouped_by_symbol[sym]["tradevalue"] = row.get('tradevalue', 0.0)
                    grouped_by_symbol[sym]["market_value"] = row.get('market_value', 0.0)
                    grouped_by_symbol[sym]["total_pnl"] = row.get('total_pnl', 0.0)
                    grouped_by_symbol[sym]["pct_pnl"] = row.get('pct_pnl', 0.0)
                    # Removed weight_tv and weight_mv from this grouping logic as they are removed from frontend display
                    grouped_by_symbol[sym]["pos_age"] = row.get('pos_age', '')
                    grouped_by_symbol[sym]["account"] = row.get('account', '')
                    grouped_by_symbol[sym]["tvm"] = row.get('tvm', 0.0) # Ensure tvm is numeric
                    grouped_by_symbol[sym]["buy_date_first"] = row.get('buy_date')

                grouped_by_symbol[sym]["totalQty"] += qty
                grouped_by_symbol[sym]["totalCost"] += qty * row.get('avg_price', 0.0)

        except Exception as row_error:
            print(f"ERROR: Problem processing row for symbol '{row.get('symbol', 'N/A')}': {row_error}")
            continue

    result_list = []
    for sym, data in grouped_by_items(grouped_by_symbol.items(), key=lambda x: x[1]['daily_change'], reverse=True): # Sorted by Daily Change
        try:
            if data["totalQty"] > 0:
                calculated_avg_buy_price = round(data["totalCost"] / data["totalQty"], 2)
                current_price = round(data["currentPrice"], 2)

                market_value = round(current_price * data["totalQty"], 2)
                pnl = round(market_value - data["totalCost"], 2)
                pct_pnl = round((pnl / data["totalCost"]) * 100, 2) if data["totalCost"] else 0.0

                entry = {
                    "symbol": sym,
                    "ticker": data["ticker"],
                    "avgPrice": calculated_avg_buy_price,
                    "totalQty": data["totalQty"],
                    "costValue": round(data["totalCost"], 2),
                    "currentPrice": current_price,
                    "marketValue": market_value,
                    "pnl": pnl,
                    "pct_pnl": pct_pnl,
                    "sector": data["sector"],
                    "daily_change": round(data["daily_change"], 2),
                    "daily_pnl": round(data["daily_pnl"], 2),
                    "tradevalue": round(data["tradevalue"], 2),
                    "total_pnl": round(data["total_pnl"], 2),
                    "pos_age": data["pos_age"],
                    "account": data["account"],
                    "tvm": round(data["tvm"], 2), # Rounded tvm here
                    "fallback": False,
                    "original_buy_date": data["buy_date_first"],
                    "original_buy_price": calculated_avg_buy_price,
                    "excel_tradevalue": round(data["tradevalue"], 2),
                    "excel_market_value": round(data["market_value"], 2),
                    "excel_total_pnl": round(data["total_pnl"], 2),
                    "excel_pct_pnl": round(data["pct_pnl"], 2),
                    "excel_tvm": round(data["tvm"], 2), # Rounded tvm here
                    "excel_pos_age": data["pos_age"]
                }
                result_list.append(entry)
        except Exception as entry_error:
            print(f"ERROR: Problem creating final entry for symbol '{sym}': {entry_error}")
            continue

    print(f"Successfully processed {len(result_list)} open positions.")
    return result_list

# Helper function for sorting defaultdict items, as it's not directly sortable
def grouped_by_items(items, key, reverse=False):
    return sorted(items, key=key, reverse=reverse)


@app.get("/realised")
async def get_closed_positions():
    """Fetches realised positions from SQLite."""
    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("""
            SELECT * FROM positions
            WHERE sell_date IS NOT NULL AND qty = 0 AND type = 'SELL'
            ORDER BY sell_date DESC
        """)
        rows = []
        for row in c.fetchall():
            d_row = dict(row)
            for key in ['buy_price', 'sell_price', 'tradevalue', 'market_value', 'total_pnl', 'pct_pnl', 'tvm']: # Added tvm
                if d_row.get(key) is not None:
                    d_row[key] = round(d_row[key], 2)
            rows.append(d_row)
        return rows


@app.get("/trades")
async def get_all_trades():
    """Fetches all trade entries from SQLite (both buys and sells)."""
    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        c.execute("""
            SELECT * FROM positions
            ORDER BY buy_date ASC
        """)
        rows = []
        for row in c.fetchall():
            d_row = dict(row)
            for key in ['buy_price', 'sell_price', 'tradevalue', 'market_value', 'total_pnl', 'pct_pnl', 'tvm']: # Added tvm
                if d_row.get(key) is not None:
                    d_row[key] = round(d_row[key], 2)
            rows.append(d_row)
        return rows

@app.get("/all_trades")
async def get_all_trades_alias():
    return await get_all_trades()

@app.post("/reload-excel-data")
async def reload_excel_data():
    """Endpoint to manually trigger a reload of Excel data."""
    load_raw_excel_data()
    return {"status": "Excel data reloaded successfully"}

# --- Run ---
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)