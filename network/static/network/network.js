document.addEventListener('DOMContentLoaded', function() {

    //Button to see profile page
    if (window.currentUser) {
        document.querySelector('#profile').addEventListener('click', function() {
            loadprofilepage(window.currentUser);
        });
    }
    //Button to create a new post
    document.querySelector('#post-form').addEventListener('submit', new_post);

    //Button to load all following posts
    document.querySelector('#following_page').addEventListener('click', function(e) {
        window.scrollTo({top: 0, behavior: 'smooth'});
        e.preventDefault();
        load_posts(true);
    });
    
    //Load all posts by default
    load_posts(false);
});


function renderPosts(posts, container, current_page, num_pages, paginationCallback) {

    container.innerHTML = '';

    //Loop over posts
    posts.forEach(post => {
        const postElement = document.createElement('div');
        postElement.className = 'post';
        const formattedContent = post.content.replace(/\n/g, '<br>');
        const likeIconSrc = post.liked ? "/static/network/heart-full-icon.jpg" : "/static/network/like-icon.png";

        postElement.innerHTML = `
            <h3 class="username" style="display: inline-block;">${post.user}</h3>
            <p id="post_content" style="margin-top: 10px;">${formattedContent}</p>
            <textarea id="edit_content" style="margin-top: 10px; width: 100%; height: 100px;">${post.content}</textarea>
            <p>
                <img src="${likeIconSrc}" alt="Like" class="like-icon" style="cursor: pointer; width: 23px; height: 20px; vertical-align: middle; display: inline-block;">
                <span class="likes-count" style="vertical-align: middle; display: inline-block; font-size: 18px">${post.likes}</span>
            </p>
            <p style="display: flex; justify-content: space-between; align-items: center;">
                <span><small class="Date">${post.timestamp}</small></span>
                <span><button style="width: 80px;" id="Edit">Edit</button></span>
            </p>`;
        container.appendChild(postElement);

        //Add event listeners for like icon and username
        const likeImg = postElement.querySelector('.like-icon');
        const usernameElem = postElement.querySelector('.username');
        usernameElem.style.cursor = 'pointer';

        usernameElem.addEventListener('click', function() {
            loadprofilepage(post.user);
        });

        likeImg.addEventListener('click', function() {

            //Send like/unlike request to server based on current UI state
            if (likeImg.src.includes('like-icon.png')) {
                likeImg.src = '/static/network/heart-full-icon.jpg';
                likeImg.style.height = '23px';
            } else {
                likeImg.src = '/static/network/like-icon.png';
                likeImg.style.height = '20px';
            }

            //Update likes count in UI
            fetch('/posts/' + post.id, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({ 
                    liked: likeImg.src.includes('heart-full-icon.jpg')
                })
            })
            .then(() => {
                if (paginationCallback) paginationCallback(current_page);
            });
        });

        //Add event listener for Edit button
        if (window.currentUser !== post.user) {
            postElement.querySelector('#Edit').style.display = 'none';
        }

        postElement.querySelector('#edit_content').style.display = 'none';
        postElement.querySelector('#Edit').addEventListener('click', function() {

            //Only allow editing if the current user is the post's author
            if (window.currentUser === post.user) {
                if (postElement.querySelector('#Edit').textContent === 'Save') {
                    const newContent = postElement.querySelector('#edit_content').value;

                    //Send updated content to server
                    fetch('/posts/' + post.id, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': getCookie('csrftoken')
                        },
                        body: JSON.stringify({
                            post_id: post.id,
                            content: newContent
                        })
                    })
                    .then(response => {
                        if (response.ok) {
                            return response.json();
                        } else {
                            throw new Error('Network response was not ok');
                        }
                    })
                    .then(data => {

                        //Update post content in the UI and switch back to view mode
                        postElement.querySelector('#post_content').innerHTML = data.content.replace(/\n/g, '<br>');
                        postElement.querySelector('#Edit').textContent = 'Edit';
                        postElement.querySelector('#post_content').style.display = 'block';
                        postElement.querySelector('#edit_content').style.display = 'none';
                    })
                    .catch(error => {
                        console.error('There was a problem with the fetch operation:', error);
                    });
                    return;
                
                }else if (postElement.querySelector('#Edit').textContent === 'Edit'){

                    //Switch to edit view
                    postElement.querySelector('#Edit').textContent = 'Save';
                    postElement.querySelector('#post_content').style.display = 'none';
                    postElement.querySelector('#edit_content').style.display = 'block';
                }
            }
        });
    });

    //Pagination controls
    if (num_pages > 1) {
        const pagination = document.createElement('nav');
        pagination.setAttribute('aria-label', '...');

        let pagHTML = '<ul class="pagination">';
        pagHTML += `<li class="page-item${current_page === 1 ? ' disabled' : ''}">
            <a class="page-link" href="#" data-page="${current_page - 1}" tabindex="-1" aria-disabled="${current_page === 1}">Previous</a>
        </li>`;

        for (let i = 1; i <= num_pages; i++) {
            pagHTML += `<li class="page-item${i === current_page ? ' active' : ''}">
                <a class="page-link" href="#" data-page="${i}">${i}${i === current_page ? ' <span class=\"sr-only\">(current)</span>' : ''}</a>
            </li>`;
        }

        pagHTML += `<li class="page-item${current_page === num_pages ? ' disabled' : ''}">
            <a class="page-link" href="#" data-page="${current_page + 1}" aria-disabled="${current_page === num_pages}">Next</a>
        </li>`;
        pagHTML += '</ul>';
        pagination.innerHTML = pagHTML;
        container.appendChild(pagination);

        //Prevent default for all pagination links to avoid full page reload
        pagination.querySelectorAll('a[data-page]').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const page = parseInt(this.getAttribute('data-page'));
                if (!isNaN(page) && page >= 1 && page <= num_pages && page !== current_page) {
                    if (paginationCallback) paginationCallback(page);

                    window.scrollTo({top: 0, behavior: 'smooth'});
                }
            });
        });
    }
}

function load_posts(following, page = 1) {

    //Show posts page and hide profile page
    document.querySelector('#posts_page').style.display = 'block';
    document.querySelector('#profile_page').style.display = 'none';

    //Fetch posts from server, either from following or all posts
    if (following) {
        fetch(`/posts/following?page=${page}`)
        .then(response => response.json())
        .then(data => {
            let posts = data.posts;
            let num_pages = data.num_pages;
            let current_page = data.current_page;
            const postsContainer = document.querySelector('#Posts');

            renderPosts(posts, postsContainer, current_page, num_pages, function(newPage) { load_posts(true, newPage); });
        });
    }else{
        fetch(`/posts?page=${page}`)
        .then(response => response.json())
        .then(data => {
            let posts = data.posts;
            let num_pages = data.num_pages;
            let current_page = data.current_page;
            const postsContainer = document.querySelector('#Posts');

            renderPosts(posts, postsContainer, current_page, num_pages, function(newPage) { load_posts(false, newPage); });
        });
    }
}

function new_post(e){

    e.preventDefault();

    const content = document.querySelector('#post_content').value;

    //Send the new post to the server
    if (content.trim() !== '') {
        fetch('/posts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                content: content
            })
        })
        .then(response => {
            if (response.ok) {
                return response.json();
            } else {
                return alert('Error: ' + response.statusText);
            }
        })
        .then(result => {
            if (result.success) {
                document.querySelector('#post_content').value = '';
                load_posts();
            } else {
                alert(result.error);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred: ' + error.message);
        });
    }
}


function loadprofilepage(username, page = 1) {

    //Show profile page and hide posts page
    document.querySelector('#posts_page').style.display = 'none';
    document.querySelector('#profile_page').style.display = 'block';
    document.querySelector('#profile_page').innerHTML = '';

    fetch(`/profile/${username}?page=${page}`)
    .then(response => response.json())
    .then(data => {
        const profileContainer = document.createElement('div');
        profileContainer.id = 'Profile';

        profileContainer.innerHTML = `<h2>${data.user}'s Profile</h2>
            <p style="font-size: 18px;">
                <span style="margin-right: 50px;">Followers: ${data.followers_count}</span>
                <span>Following: ${data.following_count}</span>
            </p>
            <button id="follow-btn" style="width: 105px;">${data.is_following ? 'Unfollow' : 'Follow'}</button>`;
        const followBtn = profileContainer.querySelector('#follow-btn');

        document.querySelector('#profile_page').appendChild(profileContainer);

        //Add event listener for follow/unfollow button if not own profile
        if (username !== window.currentUser) {
            followBtn.addEventListener('click', function() {
                fetch(`/profile/${username}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': getCookie('csrftoken')
                    },
                    body: JSON.stringify({
                        follow: !data.is_following
                    })
                })
                .then(response => response.json())
                .then(result => {
                    if (result.success) {

                        //Update button text and refresh profile information
                        followBtn.textContent = result.is_following ? 'Unfollow' : 'Follow';
                        loadprofilepage(username, page);
                    } else {
                        alert(result.error);
                    }
                });
            });
        } else {

            //Hide follow button for own profile
            followBtn.style.display = 'none'; 
        }

        //Load and render user's posts
        const postsContainer = document.createElement('div');
        postsContainer.style.marginTop = '40px';
        postsContainer.id = 'UserPosts';
        postsContainer.innerHTML = '<h3>Posts</h3>';
        document.querySelector('#profile_page').appendChild(postsContainer);

        const currentPage = data.current_page;
        const numPages = data.num_pages;

        renderPosts(data.posts, postsContainer, currentPage, numPages, function (newPage) { loadprofilepage(username, newPage); });
    });
}

//Function to get CSRF token from cookies
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}
