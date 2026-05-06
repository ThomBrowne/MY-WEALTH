from fastapi import FastAPI

from api.routes import (
    accounts,
    advisor,
    auth,
    budget,
    classify,
    currencies,
    dashboard,
    households,
    investments,
    receipts,
    transactions,
)


def include_api_routes(app: FastAPI, prefix: str = "/api/v1") -> None:
    app.include_router(auth.router, prefix=prefix)
    app.include_router(households.router, prefix=prefix)
    app.include_router(accounts.router, prefix=prefix)
    app.include_router(transactions.router, prefix=prefix)
    app.include_router(dashboard.router, prefix=prefix)
    app.include_router(investments.router, prefix=prefix)
    app.include_router(classify.router, prefix=prefix)
    app.include_router(budget.router, prefix=prefix)
    app.include_router(receipts.router, prefix=prefix)
    app.include_router(currencies.router, prefix=prefix)
    app.include_router(advisor.router, prefix=prefix)
