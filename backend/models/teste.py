from models.user import User
from db.database import Session

user1 = User(email="Patricio@ciro", password="123", is_admin=True)

db = Session()
db.add(user1)
db.commit()
db.close()
