
from django.urls import path

from . import views

urlpatterns = [
    path("", views.index, name="index"),
    path("login", views.login_view, name="login"),
    path("logout", views.logout_view, name="logout"),
    path("register", views.register, name="register"),
    path("profile/<str:username>", views.loadprofilepage, name="profile"),

    #API Routes
    path("posts", views.manage_post, name="manage_post"),
    path("posts/<int:post_id>", views.post, name="post"),
    path("posts/following", views.following_posts, name="following_posts"),
]
