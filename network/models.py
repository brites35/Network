from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    following = models.ManyToManyField('self', symmetrical=False, related_name='followers', blank=True)

    def __str__(self):
        return self.username

class Post(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="posts")
    content = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    liked = models.ManyToManyField(User, related_name='liked_posts', blank=True)

    def serialize(self, user=None):
        return {
            "id": self.id,
            "user": self.user.username,
            "content": self.content,
            "timestamp": self.timestamp.strftime("%b %d %Y, %I:%M %p"),
            "likes": self.liked.count(),
            "liked": user.is_authenticated and self.liked.filter(id=user.id).exists() if user else False,
        }

    def __str__(self):
        return f"{self.user.username}: {self.content[:20]}..."  # Display first 20 characters of content
    