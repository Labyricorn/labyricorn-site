import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { ProjectCard } from './ProjectCard';
import * as fc from 'fast-check';
import type { components } from '../types/api';

type Project = components['schemas']['ProjectSchema'];

/**
 * Feature: projects-management, Property 18: Project card rendering completeness
 * 
 * For any project displayed in the grid, the card should render all required elements:
 * hero image (if present), title, tech stack tags, and description.
 * 
 * Validates: Requirements 8.4
 */

// Arbitrary for generating valid project data
// Excludes whitespace-only strings as they violate Requirements 6.1 and 6.2
const nonEmptyString = (minLength: number, maxLength: number) =>
  fc.string({ minLength, maxLength })
    .filter(s => s.trim().length > 0);

const projectArbitrary = fc.record({
  id: fc.integer({ min: 1 }),
  title: nonEmptyString(1, 200),
  slug: nonEmptyString(1, 220),
  description: nonEmptyString(1, 1000),
  repo_url: fc.oneof(
    fc.constant(null),
    fc.webUrl()
  ),
  tech_stack: fc.array(nonEmptyString(1, 50), { maxLength: 10 }),
  hero_image: fc.record({
    url: fc.oneof(
      fc.constant(null),
      fc.webUrl()
    ),
    width: fc.oneof(
      fc.constant(null),
      fc.integer({ min: 100, max: 4000 })
    ),
    height: fc.oneof(
      fc.constant(null),
      fc.integer({ min: 100, max: 4000 })
    ),
  }),
  created_at: fc.integer({ min: 946684800000, max: 1924905600000 }).map(timestamp => new Date(timestamp).toISOString()),
});

describe('ProjectCard property-based tests', () => {
  it('Property 18: should render all required elements for any project', () => {
    fc.assert(
      fc.property(projectArbitrary, (project: Project) => {
        const onClick = vi.fn();
        const { container } = render(<ProjectCard project={project} onClick={onClick} />);

        // Verify title is rendered as H3
        const titleElement = container.querySelector('h3');
        expect(titleElement).toBeInTheDocument();
        expect(titleElement?.textContent).toBe(project.title);

        // Verify description is rendered in paragraph
        const descriptionElement = container.querySelector('p');
        expect(descriptionElement).toBeInTheDocument();
        expect(descriptionElement?.textContent).toBe(project.description);

        // Verify tech stack tags are rendered
        const techElements = container.querySelectorAll('.bg-primary\\/20');
        expect(techElements).toHaveLength(project.tech_stack.length);
        project.tech_stack.forEach((tech, index) => {
          expect(techElements[index].textContent).toBe(tech);
        });

        // Verify hero image is rendered if URL is present
        if (project.hero_image.url) {
          const imageElement = container.querySelector('img') as HTMLImageElement;
          expect(imageElement).toBeInTheDocument();
          expect(imageElement.alt).toBe(project.title);
          // Browser normalizes URLs - compare by creating URL objects
          const normalizeUrl = (url: string) => {
            try {
              return new URL(url).href.replace(/\/$/, '').replace(/\/\.$/, '');
            } catch {
              return url.replace(/\/$/, '').replace(/\/\.$/, '');
            }
          };
          expect(normalizeUrl(imageElement.src)).toBe(normalizeUrl(project.hero_image.url));
          // Check loading attribute via getAttribute since jsdom may not support the property
          expect(imageElement.getAttribute('loading')).toBe('lazy');
        } else {
          // If no hero image URL, image should not be rendered
          const imageElement = container.querySelector('img');
          expect(imageElement).not.toBeInTheDocument();
        }

        // Verify the card is clickable
        const cardElement = container.querySelector('[role="button"]');
        expect(cardElement).toBeInTheDocument();
      }),
      { numRuns: 100 } // Run 100 iterations as specified in design
    );
  });
});

/**
 * Feature: projects-management, Property 19: Project card navigation
 * 
 * For any project card, clicking it should trigger navigation to the project detail page
 * with the correct slug in the URL.
 * 
 * Validates: Requirements 8.5
 */
describe('ProjectCard navigation property-based tests', () => {
  it('Property 19: should call onClick handler when card is clicked', () => {
    fc.assert(
      fc.property(projectArbitrary, (project: Project) => {
        const onClick = vi.fn();
        const { container } = render(<ProjectCard project={project} onClick={onClick} />);

        // Find the card element
        const cardElement = container.querySelector('[role="button"]') as HTMLElement;
        expect(cardElement).toBeInTheDocument();

        // Click the card
        cardElement.click();

        // Verify onClick was called exactly once
        expect(onClick).toHaveBeenCalledTimes(1);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 19: should call onClick handler when Enter key is pressed', () => {
    fc.assert(
      fc.property(projectArbitrary, (project: Project) => {
        const onClick = vi.fn();
        const { container } = render(<ProjectCard project={project} onClick={onClick} />);

        const cardElement = container.querySelector('[role="button"]') as HTMLElement;
        expect(cardElement).toBeInTheDocument();

        // Simulate Enter key press
        cardElement.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
        );

        // Verify onClick was called
        expect(onClick).toHaveBeenCalledTimes(1);
      }),
      { numRuns: 100 }
    );
  });

  it('Property 19: should call onClick handler when Space key is pressed', () => {
    fc.assert(
      fc.property(projectArbitrary, (project: Project) => {
        const onClick = vi.fn();
        const { container } = render(<ProjectCard project={project} onClick={onClick} />);

        const cardElement = container.querySelector('[role="button"]') as HTMLElement;
        expect(cardElement).toBeInTheDocument();

        // Simulate Space key press
        cardElement.dispatchEvent(
          new KeyboardEvent('keydown', { key: ' ', bubbles: true })
        );

        // Verify onClick was called
        expect(onClick).toHaveBeenCalledTimes(1);
      }),
      { numRuns: 100 }
    );
  });
});
