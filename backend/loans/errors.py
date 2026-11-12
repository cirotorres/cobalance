from fastapi import HTTPException


def not_found(what: str = "Recurso"):
    return HTTPException(status_code=404, detail=f"{what} não encontrado.")


def conflict(msg: str):
    return HTTPException(status_code=409, detail=msg)


def invalid(msg: str):
    return HTTPException(status_code=422, detail=msg)
