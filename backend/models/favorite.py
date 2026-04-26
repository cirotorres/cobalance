from sqlalchemy import Column, Integer, String, ForeignKey
from db.database import Base

class Favorite(Base):
    __tablename__= "favoritos"
    
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)


