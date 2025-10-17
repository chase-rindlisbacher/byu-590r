import { Component } from '@angular/core';

@Component({
  selector: 'app-home',
  standalone: true,
  template: `
    <div class="home-container">
      <h2>Welcome to BYU 590R Monorepo</h2>
      <p>This is the home page of your clean slate project.</p>
      <div class="features">
        <div class="feature">
          <h3>Laravel Backend</h3>
          <p>RESTful API with MySQL database</p>
        </div>
        <div class="feature">
          <h3>Angular Frontend</h3>
          <p>Modern web application with TypeScript</p>
        </div>
        <div class="feature">
          <h3>Docker Infrastructure</h3>
          <p>Easy development and deployment</p>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .home-container {
        text-align: center;
        padding: 2rem;
      }

      .home-container h2 {
        color: #333;
        margin-bottom: 1rem;
      }

      .home-container p {
        color: #666;
        margin-bottom: 2rem;
        font-size: 1.1rem;
      }

      .features {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 2rem;
        margin-top: 2rem;
      }

      .feature {
        background: rgba(255, 255, 255, 0.8);
        padding: 1.5rem;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      }

      .feature h3 {
        color: #667eea;
        margin-bottom: 0.5rem;
      }

      .feature p {
        color: #666;
        margin: 0;
        font-size: 0.9rem;
      }
    `,
  ],
})
export class HomeComponent {}
