# File: main.py

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import date, datetime
import sqlite3
import uvicorn
import pandas as pd
from collections import defaultdict
import numpy as np
import os

app = FastAPI()

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Database & File Paths ---
DB_NAME = "portfolio.db"
POSITIONS_EXCEL_FILE = "/Users/abhisheksingh/Library/CloudStorage/OneDrive-Personal/mfarm/factor9.xlsx"
DIVIDENDS_EXCEL_FILE = "/Users/abhisheksingh/Library/CloudStorage/OneDrive-Personal/mfarm/dividends.xlsx"


def init_db():
    with sqlite3.connect(DB_NAME) as conn:
        c = conn.cursor()
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
                tvm REAL,
                pos_age TEXT
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS portfolio_snapshots (
                date TEXT PRIMARY KEY,
                market_value REAL,
                total_cost_value REAL,
                total_pnl REAL,
                daily_pnl_sum REAL,
                portfolio_index_value REAL,
                net_cash_flow_today REAL
            )
        """)
        conn.commit()

init_db()

_raw_excel_data = []
_dividends_data = []

def load_raw_excel_data():
    """Loads all raw data from the Excel file."""
    global _raw_excel_data
    print(f"Attempting to load data from: {POSITIONS_EXCEL_FILE}")
    try:
        df = pd.read_excel(POSITIONS_EXCEL_FILE)
        print(f"Excel file '{POSITIONS_EXCEL_FILE}' read successfully.")
        print("Original Columns (Positions):", df.columns.tolist())

        df.columns = df.columns.str.lower()
        print("Lowercased Columns (Positions):", df.columns.tolist())

        df['symbol'] = df['symbol'].astype(str).str.upper().str.strip()
        df['buy_date'] = pd.to_datetime(df['buy_date'], errors='coerce').dt.strftime('%Y-%m-%d')
        df['qty'] = pd.to_numeric(df['qty'], errors='coerce').fillna(0).astype(int)

        currency_like_cols = [
            'current_price', 'avg_price', 'delta', 'daily_change', 'daily_pnl',
            'tradevalue', 'market_value', 'total_pnl',
        ]
        for col in currency_like_cols:
            if col in df.columns:
                df[col] = df[col].astype(str).str.replace(r'[₹,]', '', regex=True)
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0)
            else:
                df[col] = 0.0

        other_numeric_cols = [
            'pct_pnl', 'weight_tv', 'weight_mv', 'tvm', 'pos_age'
        ]
        for col in other_numeric_cols:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0)
            else:
                df[col] = 0.0

        string_cols = ['sector', 'account', 'ticker', 'ms_ticker']
        for col in string_cols:
            if col in df.columns:
                df[col] = df[col].fillna('').astype(str).str.strip()
            else:
                df[col] = ''

        _raw_excel_data = df.to_dict(orient='records')
        print(f"Raw Excel data loaded into memory: {len(_raw_excel_data)} records.")

    except FileNotFoundError:
        print(f"ERROR: {POSITIONS_EXCEL_FILE} not found. Ensure the Excel file exists in the same directory as main.py.")
        _raw_excel_data = []
    except Exception as e:
        print(f"CRITICAL ERROR during load_raw_excel_data: {type(e).__name__}: {e}")
        _raw_excel_data = []

def load_dividends_data():
    """Loads dividend data from the Excel file."""
    global _dividends_data
    print(f"Attempting to load dividend data from: {DIVIDENDS_EXCEL_FILE}")
    if not os.path.exists(DIVIDENDS_EXCEL_FILE):
        print(f"WARNING: {DIVIDENDS_EXCEL_FILE} not found. Skipping dividend data load.")
        _dividends_data = []
        return

    try:
        df = pd.read_excel(DIVIDENDS_EXCEL_FILE)
        print(f"Dividend Excel file '{DIVIDENDS_EXCEL_FILE}' read successfully.")
        print("Original Columns (before lowercasing/renaming):", df.columns.tolist())

        df.columns = df.columns.str.lower().str.replace(' ', '_')
        print("Columns after lowercasing and underscore replacement:", df.columns.tolist())

        rename_map = {}
        if 'date_of_disbursment' in df.columns:
            rename_map['date_of_disbursment'] = 'date_of_disbur'
        if 'rs_per_share_' in df.columns:
            rename_map['rs_per_share_'] = 'rs_per_share'

        if rename_map:
            df = df.rename(columns=rename_map)
            print("Columns after specific renames:", df.columns.tolist())

        numeric_cols = ['amount', 'rs_per_share', 'qty']
        for col in numeric_cols:
            if col in df.columns:
                df[col] = df[col].astype(str).str.replace(r'[₹,]', '', regex=True)
                df[col] = pd.to_numeric(df[col], errors='coerce')

        if 'date_of_disbur' in df.columns:
            df['date_of_disbur'] = pd.to_datetime(df['date_of_disbur'], format='%d-%b-%y', errors='coerce').dt.strftime('%Y-%m-%d')
        else:
            df['date_of_disbur'] = None

        for col in ['ticker', 'sector']:
            if col in df.columns:
                df[col] = df[col].fillna('').astype(str).str.strip()
            else:
                df[col] = ''

        for col in df.columns:
            if pd.api.types.is_float_dtype(df[col]):
                df[col] = df[col].fillna(0.0)
            elif pd.api.types.is_object_dtype(df[col]):
                df[col] = df[col].fillna('')

        _dividends_data = df.to_dict(orient='records')
        print(f"Dividend data loaded into memory: {len(_dividends_data)} records.")

    except FileNotFoundError:
        print(f"CRITICAL ERROR: {DIVIDENDS_EXCEL_FILE} not found. Ensure the Excel file exists.")
        _dividends_data = []
    except Exception as e:
        print(f"CRITICAL ERROR during load_dividends_data: {type(e).__name__}: {e}")
        _dividends_data = []


# --- Initial Load ---
load_raw_excel_data()
load_dividends_data()


# --- Schema ---
class TradeInput(BaseModel):
    symbol: str = Field(..., min_length=1, pattern=r"^[a-zA-Z0-9]+$")
    ticker: Optional[str] = None
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
    tvm: Optional[float] = None
    pos_age: Optional[str] = None

class PortfolioSnapshotRequest(BaseModel):
    net_cash_flow_today: float = 0.0


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
                round(sell_record.tvm, 2) if sell_record.tvm is not None else None,
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
        "tvm": 0.0,
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
                'tradevalue', 'market_value', 'total_pnl', 'pct_pnl', 'weight_tv', 'weight_mv', 'tvm'
            ]:
                if pd.isna(row.get(k)):
                    row[k] = 0.0
                else:
                    row[k] = float(row[k])

            for k in ['sector', 'pos_age', 'account']:
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
                    grouped_by_symbol[sym]["pos_age"] = row.get('pos_age', '')
                    grouped_by_symbol[sym]["account"] = row.get('account', '')
                    grouped_by_symbol[sym]["tvm"] = row.get('tvm', 0.0)
                    grouped_by_symbol[sym]["buy_date_first"] = row.get('buy_date')

                grouped_by_symbol[sym]["totalQty"] += qty
                grouped_by_symbol[sym]["totalCost"] += qty * row.get('avg_price', 0.0)

        except Exception as row_error:
            print(f"ERROR: Problem processing row for symbol '{row.get('symbol', 'N/A')}': {row_error}")
            continue

    result_list = []
    for sym, data in grouped_by_symbol.items():
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
                    "daily_change": data["daily_change"],
                    "daily_pnl": round(data["daily_pnl"], 2),
                    "tradevalue": round(data["tradevalue"], 2),
                    "total_pnl": round(data["total_pnl"], 2),
                    "pos_age": data["pos_age"],
                    "account": data["account"],
                    "tvm": round(data["tvm"], 2),
                    "fallback": False,
                    "original_buy_date": data["buy_date_first"],
                    "original_buy_price": calculated_avg_buy_price,
                    "excel_tradevalue": round(data["tradevalue"], 2),
                    "excel_market_value": round(data["market_value"], 2),
                    "excel_total_pnl": round(data["pct_pnl"], 2),
                    "excel_pct_pnl": round(data["pct_pnl"], 2),
                    "excel_tvm": round(data["tvm"], 2),
                    "excel_pos_age": data["pos_age"]
                }
                result_list.append(entry)
        except Exception as entry_error:
            print(f"ERROR: Problem creating final entry for symbol '{sym}': {entry_error}")
            continue

    print(f"Successfully processed {len(result_list)} open positions.")
    return result_list


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
            for key in ['buy_price', 'sell_price', 'tradevalue', 'market_value', 'total_pnl', 'pct_pnl', 'tvm']:
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
            for key in ['buy_price', 'sell_price', 'tradevalue', 'market_value', 'total_pnl', 'pct_pnl', 'tvm']:
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

@app.post("/snapshot")
async def take_snapshot(request: PortfolioSnapshotRequest):
    today_str = datetime.now().strftime('%Y-%m-%d')
    today_date_obj = datetime.strptime(today_str, '%Y-%m-%d').date()

    # ⚡️ FIX: Prevent taking snapshots on weekends ⚡️
    # weekday() returns 0 for Monday, 6 for Sunday
    if today_date_obj.weekday() >= 5: # 5 is Saturday, 6 is Sunday
        raise HTTPException(status_code=400, detail="Snapshots can only be taken on weekdays.")

    current_market_value = sum(pos['current_price'] * pos['qty'] for pos in _raw_excel_data)
    total_cost_value = sum(pos['avg_price'] * pos['qty'] for pos in _raw_excel_data)
    total_pnl = current_market_value - total_cost_value
    daily_pnl_sum = sum(pos['daily_pnl'] for pos in _raw_excel_data)

    portfolio_index_value = 0.0
    message = ""

    with sqlite3.connect(DB_NAME) as conn:
        c = conn.cursor()
        # Since we prevent weekend snapshots, the latest snapshot will always be a weekday
        c.execute("SELECT * FROM portfolio_snapshots ORDER BY date DESC LIMIT 1")
        last_snapshot_row = c.fetchone()

        if not last_snapshot_row:
            portfolio_index_value = 100.0
            message = "Initial portfolio snapshot taken. Index set to 100 (base for relative performance)."
        else:
            last_snapshot = {
                "date": last_snapshot_row[0],
                "market_value": last_snapshot_row[1],
                "total_cost_value": last_snapshot_row[2],
                "total_pnl": last_snapshot_row[3],
                "daily_pnl_sum": last_snapshot_row[4],
                "portfolio_index_value": last_snapshot_row[5],
                "net_cash_flow_today": last_snapshot_row[6]
            }

            c.execute("DELETE FROM portfolio_snapshots WHERE date = ?", (today_str,))
            if c.rowcount > 0:
                print(f"Existing snapshot for {today_str} deleted for update.")
                message = f"Portfolio snapshot for {today_str} updated."
            else:
                message = f"Portfolio snapshot taken for {today_str}."


            pmv_yesterday = last_snapshot['market_value']
            index_yesterday = last_snapshot['portfolio_index_value']
            net_cash_flow_today = request.net_cash_flow_today

            denominator = pmv_yesterday + (0.5 * net_cash_flow_today)

            if denominator > 0:
                daily_return_rate = (current_market_value - pmv_yesterday - net_cash_flow_today) / denominator
                portfolio_index_value = index_yesterday * (1 + daily_return_rate)
            elif current_market_value > 0 and net_cash_flow_today > 0:
                portfolio_index_value = 100.0
                print("Index reset to 100 due to new capital from a zero/negative base.")
            else:
                if index_yesterday == 0 and current_market_value == 0:
                     portfolio_index_value = 0.0
                else:
                    portfolio_index_value = index_yesterday
                print("Index unchanged (no meaningful activity/calculation for the day).")

        c.execute("""
            INSERT OR REPLACE INTO portfolio_snapshots (
                date, market_value, total_cost_value, total_pnl, daily_pnl_sum, portfolio_index_value, net_cash_flow_today
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            today_str,
            round(current_market_value, 2),
            round(total_cost_value, 2),
            round(total_pnl, 2),
            round(daily_pnl_sum, 2),
            round(portfolio_index_value, 2),
            round(request.net_cash_flow_today, 2)
        ))
        conn.commit()

    return {"message": message, "snapshot": {
        "date": today_str,
        "market_value": round(current_market_value, 2),
        "total_cost_value": round(total_cost_value, 2),
        "total_pnl": round(total_pnl, 2),
        "daily_pnl_sum": round(daily_pnl_sum, 2),
        "portfolio_index_value": round(portfolio_index_value, 2),
        "net_cash_flow_today": round(request.net_cash_flow_today, 2)
    }}

@app.get("/portfolio-history")
async def get_portfolio_history():
    with sqlite3.connect(DB_NAME) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        # Since weekend snapshots are prevented, this will naturally return only weekday data
        c.execute("SELECT * FROM portfolio_snapshots ORDER BY date ASC")
        rows = [dict(row) for row in c.fetchall()]
        return rows

@app.get("/calculate-live-index")
async def calculate_live_index(
    net_cash_flow_today: float = 0.0
):
    today_str = datetime.now().strftime('%Y-%m-%d')

    current_market_value = sum(pos['current_price'] * pos['qty'] for pos in _raw_excel_data)
    total_cost_value = sum(pos['avg_price'] * pos['qty'] for pos in _raw_excel_data)
    total_pnl = current_market_value - total_cost_value
    daily_pnl_sum = sum(pos['daily_pnl'] for pos in _raw_excel_data)

    live_portfolio_index_value = 0.0

    with sqlite3.connect(DB_NAME) as conn:
        c = conn.cursor()
        # Since we prevent weekend snapshots, the latest snapshot will always be a weekday
        c.execute("SELECT * FROM portfolio_snapshots ORDER BY date DESC LIMIT 1")
        last_snapshot_row = c.fetchone()

        if not last_snapshot_row:
            live_portfolio_index_value = 100.0
        else:
            last_snapshot = {
                "date": last_snapshot_row[0],
                "market_value": last_snapshot_row[1],
                "total_cost_value": last_snapshot_row[2],
                "total_pnl": last_snapshot_row[3],
                "daily_pnl_sum": last_snapshot_row[4],
                "portfolio_index_value": last_snapshot_row[5],
                "net_cash_flow_today": last_snapshot_row[6]
            }

            pmv_yesterday = last_snapshot['market_value']
            index_yesterday = last_snapshot['portfolio_index_value']

            denominator = pmv_yesterday + (0.5 * net_cash_flow_today)

            if denominator > 0:
                daily_return_rate = (current_market_value - pmv_yesterday - net_cash_flow_today) / denominator
                live_portfolio_index_value = index_yesterday * (1 + daily_return_rate)
            elif current_market_value > 0 and net_cash_flow_today > 0:
                live_portfolio_index_value = 100.0
            else:
                if index_yesterday == 0 and current_market_value == 0:
                     live_portfolio_index_value = 0.0
                else:
                    live_portfolio_index_value = index_yesterday

    return {
        "live_portfolio_index_value": round(live_portfolio_index_value, 2),
        "current_market_value": round(current_market_value, 2),
        "total_cost_value": round(total_cost_value, 2),
        "total_pnl": round(total_pnl, 2),
        "daily_pnl_sum": round(daily_pnl_sum, 2)
    }

@app.get("/dividends")
async def get_dividends():
    """Returns raw and aggregated dividend data."""
    if not _dividends_data:
        load_dividends_data()
        if not _dividends_data:
            raise HTTPException(status_code=500, detail="Failed to load dividend data.")

    total_amount_by_ticker = defaultdict(float)
    total_dividend_earned = 0.0
    dividends_by_year = defaultdict(float)

    for record in _dividends_data:
        ticker = record.get('ticker', 'N/A')
        amount = record.get('amount', 0.0)
        date_str = record.get('date_of_disbur')

        total_dividend_earned += amount
        total_amount_by_ticker[ticker] += amount

        if date_str:
            try:
                year = datetime.strptime(date_str, '%Y-%m-%d').year
                dividends_by_year[year] += amount
            except ValueError:
                print(f"WARNING: Could not parse date '{date_str}' for yearly aggregation.")

    sorted_raw_data = sorted(
        _dividends_data,
        key=lambda x: x.get('date_of_disbur', '0000-00-00'),
        reverse=True
    )

    chart_data = []
    for k, v in total_amount_by_ticker.items():
        if k.upper() != 'HISTDIVIDENDS':
            chart_data.append({"ticker": k, "total_amount": v})
    chart_data.sort(key=lambda x: x['total_amount'], reverse=True)

    yearly_chart_data = [{"year": year, "total_amount": amount} for year, amount in dividends_by_year.items()]
    yearly_chart_data.sort(key=lambda x: x['year'])

    return {
        "raw_data": sorted_raw_data,
        "chart_data": chart_data,
        "total_dividend_earned": round(total_dividend_earned, 2),
        "dividends_by_year": yearly_chart_data
    }

@app.post("/reload-dividends-data")
async def reload_dividends_data():
    """Endpoint to manually trigger a reload of dividend Excel data."""
    load_dividends_data()
    return {"status": "Dividend data reloaded successfully"}


# --- Run ---
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
