from fastapi import FastAPI

app = FastAPI()

items =[]

@app.get("/")
def root():
    return {"Hello": "World"}


@app.post("/items")
def create_item(item:str):
    items.append(item)
    return items

@app.post("/items/{item_id}")
def get_item(item_id: int) -> str:
    return items[item_id]