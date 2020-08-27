const app = new Vue({
    el: '#app',
    data: {
        url: '',
        error: '',
        formVisible: true,
        created: null,
    },
    methods: {
        async createUrl() {
            this.error = '';
            const response = await fetch('/url', {
                method: 'POST',
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    url: this.url,
                }),
            });
            if (response.ok) {
                const result = await response.json();
                this.formVisible = false;
                this.created = `https://ege.works/${result.slug}`;
            } else if (response.status === 429) {
                this.error = 'You are sending too many requests.';
            } else {
                const result = await response.json();
                this.error = result.message;
            }
        },
    },
});