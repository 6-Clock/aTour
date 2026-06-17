from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

items =[]

@app.get("/")
def root():
    return {"Hello": "World"}


@app.post("/items")
def create_item(item:str):
    items.append(item)
    return items

@app.get("/items")
def list_items(limit: int = 10):
    return items[0:limit]

@app.post("/items/{item_id}")
def get_item(item_id: int) -> str:  
    if item_id < len(items):
        return items[item_id]
    else:
        raise HTTPException(status_code=404, detail="Item not found")