import json
from django.contrib.auth import authenticate, login, logout
from django.db import IntegrityError
from django.http import HttpResponse, HttpResponseRedirect
from django.http import JsonResponse
from django.shortcuts import render
from django.urls import reverse
from django.core.paginator import Paginator
from django.contrib.auth.decorators import login_required

from .models import User, Post


def index(request):
    if not request.user.is_authenticated:
        return HttpResponseRedirect(reverse("login"))
    return render(request, "network/index.html")


def login_view(request):
    if request.method == "POST":

        # Attempt to sign user in
        username = request.POST["username"]
        password = request.POST["password"]
        user = authenticate(request, username=username, password=password)

        # Check if authentication successful
        if user is not None:
            login(request, user)
            return HttpResponseRedirect(reverse("index"))
        else:
            return render(request, "network/login.html", {
                "message": "Invalid username and/or password."
            })
    else:
        return render(request, "network/login.html")


def logout_view(request):
    logout(request)
    return HttpResponseRedirect(reverse("index"))


def register(request):
    if request.method == "POST":
        username = request.POST["username"]
        email = request.POST["email"]

        # Ensure password matches confirmation
        password = request.POST["password"]
        confirmation = request.POST["confirmation"]
        if password != confirmation:
            return render(request, "network/register.html", {
                "message": "Passwords must match."
            })
        # Attempt to create new user
        try:
            user = User.objects.create_user(username, email, password)
            user.save()
        except IntegrityError:
            return render(request, "network/register.html", {
                "message": "Username already taken."
            })

        login(request, user)
        return HttpResponseRedirect(reverse("index"))
    else:
        return render(request, "network/register.html")
    
@login_required
def manage_post(request):
    if request.method == "POST":
        data = json.loads(request.body)
        content = data.get("content", "")
        
        if not content:
            return JsonResponse({"error": "Content cannot be empty."}, status=400)

        post = Post.objects.create(user=request.user, content=content)
        return JsonResponse({"success": True, "post_id": post.id}, status=201)
    
    elif request.method == "GET":
        posts = Post.objects.all().order_by('-timestamp')
        paginator = Paginator(posts, 10)
        page_number = request.GET.get('page')
        page_obj = paginator.get_page(page_number)
        return JsonResponse({
            "posts": [post.serialize(request.user) for post in page_obj],
            "num_pages": paginator.num_pages,
            "current_page": page_obj.number
        }, safe=False)
    else:
        return HttpResponse("Method not allowed.", status=405)
        
@login_required
def following_posts(request):
    if request.method == "POST":
        data = json.loads(request.body)
        content = data.get("content", "")
        
        if not content:
            return JsonResponse({"error": "Content cannot be empty."}, status=400)

        post = Post.objects.create(user=request.user, content=content)
        return JsonResponse({"success": True, "post_id": post.id}, status=201)
    elif request.method == "GET":
        if not request.user.is_authenticated:
            return JsonResponse({"error": "Authentication required."}, status=403)
        
        posts = Post.objects.filter(user__in=request.user.following.all()).order_by('-timestamp')
        paginator = Paginator(posts, 10)
        page_number = request.GET.get('page')
        page_obj = paginator.get_page(page_number)
        
        return JsonResponse({
            "posts": [post.serialize(request.user) for post in page_obj],
            "num_pages": paginator.num_pages,
            "current_page": page_obj.number
        }, safe=False)
    else:
        return HttpResponse("Method not allowed.", status=405)

@login_required
def post(request, post_id):
    try:
        post = Post.objects.get(id=post_id)
    except Post.DoesNotExist:
        return HttpResponse("Post not found.", status=404)
    
    if request.method == "GET":
        return JsonResponse({
            "post": post.serialize()
        })

    elif request.method == "PUT":
        if (json.loads(request.body).get("content") is not None):
            data = json.loads(request.body)
            post_id = data.get("post_id")
            new_content = data.get("content", "")
            
            if not new_content:
                return JsonResponse({"error": "Content cannot be empty."}, status=400)

            try:
                post = Post.objects.get(id=post_id, user=request.user)
                post.content = new_content
                post.save()
                return JsonResponse({"success": True, "content": post.content}, status=200)
            except Post.DoesNotExist:
                return JsonResponse({"error": "Post not found or unauthorized."}, status=404)
        else:
            data = json.loads(request.body)
            
            if data.get("liked") is not None:
                if data["liked"]:
                    post.liked.add(request.user)
                else:
                    post.liked.remove(request.user)
                post.save()
                return JsonResponse({"success": True, "likes": post.liked.count()}, status=200)
    else:
        return JsonResponse({"error": "Method must be GET or PUT."}, status=400)

@login_required
def loadprofilepage(request, username):
    try:
        user = User.objects.get(username=username)
    except User.DoesNotExist:
        return HttpResponse("User not found.", status=404)
    
    if request.method == "GET":
        posts = user.posts.all().order_by('-timestamp')
        paginator = Paginator(posts, 10)
        page_number = request.GET.get('page')
        page_obj = paginator.get_page(page_number)
        
        return JsonResponse({
            "user": user.username,
            "followers_count": user.followers.count(),
            "following_count": user.following.count(),
            "is_following": user.followers.filter(id=request.user.id).exists() if request.user.is_authenticated else False,
            "posts": [post.serialize(request.user) for post in page_obj],
            "num_pages": paginator.num_pages,
            "current_page": page_obj.number
        }, safe=False)
    elif request.method == "PUT":
        data = json.loads(request.body)
        if "follow" in data:
            if data["follow"]:
                user.followers.add(request.user)
            else:
                user.followers.remove(request.user)
            user.save()
            return JsonResponse({"success": True, "followers_count": user.followers.count()}, status=200)
        else:
            return JsonResponse({"error": "Invalid request."}, status=400)