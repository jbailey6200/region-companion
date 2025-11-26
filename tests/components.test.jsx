// tests/components.test.jsx
// Component tests for shared form and message components

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock Firebase
jest.mock("../src/firebase/config.js", () => ({
  db: {},
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  onSnapshot: jest.fn(() => () => {}),
}));

// Import components after mocks
import ArmyForm from "../src/components/ArmyForm.jsx";
import CharacterForm from "../src/components/CharacterForm.jsx";
import { ComposeModal, MessageList, MessageDetailModal, Mailbox } from "../src/components/MessageSystem.jsx";

describe("ArmyForm", () => {
  const mockRegions = [
    { id: "1", code: "A1", name: "Northern Plains" },
    { id: "2", code: "B2", name: "Eastern Forest" },
    { id: "3", code: "C3", name: "Southern Coast" },
  ];

  test("renders form with all fields", () => {
    render(<ArmyForm regions={mockRegions} onSubmit={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByText("New Army")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Army name")).toBeInTheDocument();
    expect(screen.getByText("-- Select Location --")).toBeInTheDocument();
    expect(screen.getByText("Create")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  test("renders region options sorted by code", () => {
    render(<ArmyForm regions={mockRegions} onSubmit={jest.fn()} onCancel={jest.fn()} />);
    const select = screen.getByRole("combobox");
    const options = Array.from(select.querySelectorAll("option"));
    expect(options[1].textContent).toContain("[A1]");
    expect(options[2].textContent).toContain("[B2]");
    expect(options[3].textContent).toContain("[C3]");
  });

  test("calls onSubmit with form data", async () => {
    const mockSubmit = jest.fn();
    render(<ArmyForm regions={mockRegions} onSubmit={mockSubmit} onCancel={jest.fn()} />);
    await userEvent.type(screen.getByPlaceholderText("Army name"), "Test Army");
    await userEvent.selectOptions(screen.getByRole("combobox"), "A1");
    await userEvent.click(screen.getByText("Create"));
    expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: "Test Army", location: "A1" }));
  });

  test("calls onCancel when cancel clicked", async () => {
    const mockCancel = jest.fn();
    render(<ArmyForm regions={mockRegions} onSubmit={jest.fn()} onCancel={mockCancel} />);
    await userEvent.click(screen.getByText("Cancel"));
    expect(mockCancel).toHaveBeenCalled();
  });

  test("resets form after submit", async () => {
    const mockSubmit = jest.fn();
    render(<ArmyForm regions={mockRegions} onSubmit={mockSubmit} onCancel={jest.fn()} />);
    const nameInput = screen.getByPlaceholderText("Army name");
    await userEvent.type(nameInput, "Test Army");
    await userEvent.click(screen.getByText("Create"));
    expect(nameInput.value).toBe("");
  });
});

describe("CharacterForm", () => {
  test("renders form with name fields", () => {
    render(<CharacterForm onSubmit={jest.fn()} onCancel={jest.fn()} />);
    expect(screen.getByPlaceholderText("First name")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Last name")).toBeInTheDocument();
  });

  test("shows random stats message when randomStats=true", () => {
    render(<CharacterForm onSubmit={jest.fn()} onCancel={jest.fn()} randomStats={true} />);
    expect(screen.getByText(/Stats will be randomly generated/)).toBeInTheDocument();
  });

  test("shows stat inputs when showStats=true", () => {
    render(<CharacterForm onSubmit={jest.fn()} onCancel={jest.fn()} randomStats={false} showStats={true} />);
    expect(screen.getByText("leadership")).toBeInTheDocument();
    expect(screen.getByText("prowess")).toBeInTheDocument();
    expect(screen.getByText("stewardship")).toBeInTheDocument();
    expect(screen.getByText("intrigue")).toBeInTheDocument();
  });

  test("hides stat inputs when showStats=false", () => {
    render(<CharacterForm onSubmit={jest.fn()} onCancel={jest.fn()} showStats={false} />);
    expect(screen.queryByText("leadership")).not.toBeInTheDocument();
  });

  test("uses custom title when provided", () => {
    render(<CharacterForm onSubmit={jest.fn()} onCancel={jest.fn()} title="Custom Title" />);
    expect(screen.getByText("Custom Title")).toBeInTheDocument();
  });

  test("shows description when provided", () => {
    render(<CharacterForm onSubmit={jest.fn()} onCancel={jest.fn()} description="Test description" />);
    expect(screen.getByText("Test description")).toBeInTheDocument();
  });

  test("calls onSubmit with character data", async () => {
    const mockSubmit = jest.fn();
    render(<CharacterForm onSubmit={mockSubmit} onCancel={jest.fn()} randomStats={false} showStats={true} />);
    await userEvent.type(screen.getByPlaceholderText("First name"), "John");
    await userEvent.type(screen.getByPlaceholderText("Last name"), "Smith");
    await userEvent.click(screen.getByText("Create Character"));
    expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({
      firstName: "John",
      lastName: "Smith",
      leadership: 5,
      prowess: 5,
      stewardship: 5,
      intrigue: 5,
    }));
  });

  test("generates random stats when randomStats=true", async () => {
    const mockSubmit = jest.fn();
    const mockRandom = jest.spyOn(Math, "random");
    mockRandom.mockReturnValue(0.5);
    render(<CharacterForm onSubmit={mockSubmit} onCancel={jest.fn()} randomStats={true} />);
    await userEvent.type(screen.getByPlaceholderText("First name"), "John");
    await userEvent.click(screen.getByText("Create Character"));
    expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({
      firstName: "John",
      leadership: 6,
      prowess: 6,
      stewardship: 6,
      intrigue: 6,
    }));
    mockRandom.mockRestore();
  });

  test("calls onCancel when cancel clicked", async () => {
    const mockCancel = jest.fn();
    render(<CharacterForm onSubmit={jest.fn()} onCancel={mockCancel} />);
    await userEvent.click(screen.getByText("Cancel"));
    expect(mockCancel).toHaveBeenCalled();
  });
});

describe("MessageSystem", () => {
  describe("ComposeModal", () => {
    const defaultProps = {
      isOpen: true,
      onClose: jest.fn(),
      onSend: jest.fn(),
      recipients: { "1": "Faction One", "2": "Faction Two" },
      senderName: "Test Sender",
    };

    test("renders nothing when isOpen=false", () => {
      const { container } = render(<ComposeModal {...defaultProps} isOpen={false} />);
      expect(container.firstChild).toBeNull();
    });

    test("renders modal when isOpen=true", () => {
      render(<ComposeModal {...defaultProps} />);
      expect(screen.getByText(/Compose Message/)).toBeInTheDocument();
    });

    test("shows GM title when isGM=true", () => {
      render(<ComposeModal {...defaultProps} isGM={true} />);
      expect(screen.getByText(/Send Royal Decree/)).toBeInTheDocument();
    });

    test("renders recipient dropdown with options", () => {
      render(<ComposeModal {...defaultProps} />);
      expect(screen.getByText("Faction One")).toBeInTheDocument();
      expect(screen.getByText("Faction Two")).toBeInTheDocument();
    });

    test("shows character count when maxLength provided", () => {
      render(<ComposeModal {...defaultProps} maxLength={250} />);
      expect(screen.getByText("0/250")).toBeInTheDocument();
    });

    test("updates character count as user types", async () => {
      render(<ComposeModal {...defaultProps} maxLength={250} />);
      await userEvent.type(screen.getByPlaceholderText("Write your message..."), "Hello");
      expect(screen.getByText("5/250")).toBeInTheDocument();
    });

    test("shows preview when message entered", async () => {
      render(<ComposeModal {...defaultProps} />);
      await userEvent.type(screen.getByPlaceholderText("Write your message..."), "Test message");
      expect(screen.getByText("Preview:")).toBeInTheDocument();
      expect(screen.getByText(/Test message/)).toBeInTheDocument();
    });

    test("calls onSend with message data", async () => {
      const mockSend = jest.fn();
      render(<ComposeModal {...defaultProps} onSend={mockSend} />);
      await userEvent.selectOptions(screen.getByRole("combobox"), "2");
      await userEvent.type(screen.getByPlaceholderText("Write your message..."), "Test message");
      await userEvent.click(screen.getByText(/Send/));
      expect(mockSend).toHaveBeenCalledWith({ to: "2", body: "Test message" });
    });

    test("disables send button when message empty", () => {
      render(<ComposeModal {...defaultProps} />);
      const sendButton = screen.getByText(/Send/);
      expect(sendButton).toBeDisabled();
    });

    test("calls onClose when cancel clicked", async () => {
      const mockClose = jest.fn();
      render(<ComposeModal {...defaultProps} onClose={mockClose} />);
      await userEvent.click(screen.getByText("Cancel"));
      expect(mockClose).toHaveBeenCalled();
    });
  });

  describe("MessageList", () => {
    const mockMessages = [
      {
        id: "1",
        fromFactionName: "Faction One",
        body: "Test message 1",
        read: false,
        createdAt: { toDate: () => new Date("2024-01-15") },
      },
      {
        id: "2",
        fromFactionName: "Faction Two",
        body: "Test message 2",
        read: true,
        createdAt: { toDate: () => new Date("2024-01-14") },
      },
    ];

    test("shows empty state when no messages", () => {
      render(<MessageList messages={[]} onSelect={jest.fn()} emptyText="No messages" />);
      expect(screen.getByText("No messages")).toBeInTheDocument();
    });

    test("renders message list", () => {
      render(<MessageList messages={mockMessages} onSelect={jest.fn()} />);
      expect(screen.getByText(/Faction One/)).toBeInTheDocument();
      expect(screen.getByText(/Faction Two/)).toBeInTheDocument();
    });

    test("shows NEW badge for unread messages", () => {
      render(<MessageList messages={mockMessages} onSelect={jest.fn()} />);
      expect(screen.getByText("NEW")).toBeInTheDocument();
    });

    test("calls onSelect when message clicked", async () => {
      const mockSelect = jest.fn();
      render(<MessageList messages={mockMessages} onSelect={mockSelect} />);
      await userEvent.click(screen.getByText(/Faction One/));
      expect(mockSelect).toHaveBeenCalledWith(mockMessages[0]);
    });

    test("calls onMarkRead for unread messages", async () => {
      const mockMarkRead = jest.fn();
      render(<MessageList messages={mockMessages} onSelect={jest.fn()} onMarkRead={mockMarkRead} />);
      await userEvent.click(screen.getByText(/Faction One/));
      expect(mockMarkRead).toHaveBeenCalledWith("1");
    });

    test("does not call onMarkRead for already read messages", async () => {
      const mockMarkRead = jest.fn();
      render(<MessageList messages={mockMessages} onSelect={jest.fn()} onMarkRead={mockMarkRead} />);
      await userEvent.click(screen.getByText(/Faction Two/));
      expect(mockMarkRead).not.toHaveBeenCalled();
    });
  });

  describe("MessageDetailModal", () => {
    const mockMessage = {
      id: "1",
      fromFactionName: "Faction One",
      body: "Test message body",
      read: true,
      createdAt: { toDate: () => new Date("2024-01-15") },
    };

    test("renders nothing when message is null", () => {
      const { container } = render(<MessageDetailModal message={null} onClose={jest.fn()} />);
      expect(container.firstChild).toBeNull();
    });

    test("renders message details", () => {
      render(<MessageDetailModal message={mockMessage} onClose={jest.fn()} />);
      expect(screen.getByText(/Faction One/)).toBeInTheDocument();
      expect(screen.getByText(/Test message body/)).toBeInTheDocument();
    });

    test("shows mission result for mission type", () => {
      const missionMessage = { ...mockMessage, type: "mission", success: true };
      render(<MessageDetailModal message={missionMessage} onClose={jest.fn()} />);
      expect(screen.getByText(/Mission Successful/)).toBeInTheDocument();
    });

    test("shows failure for failed mission", () => {
      const missionMessage = { ...mockMessage, type: "mission", success: false };
      render(<MessageDetailModal message={missionMessage} onClose={jest.fn()} />);
      expect(screen.getByText(/Mission Failed/)).toBeInTheDocument();
    });

    test("calls onClose when close clicked", async () => {
      const mockClose = jest.fn();
      render(<MessageDetailModal message={mockMessage} onClose={mockClose} />);
      await userEvent.click(screen.getByText("Close"));
      expect(mockClose).toHaveBeenCalled();
    });

    test("shows delete button when onDelete provided", () => {
      render(<MessageDetailModal message={mockMessage} onClose={jest.fn()} onDelete={jest.fn()} />);
      expect(screen.getByText(/Delete/)).toBeInTheDocument();
    });

    test("calls onDelete when delete clicked", async () => {
      const mockDelete = jest.fn();
      render(<MessageDetailModal message={mockMessage} onClose={jest.fn()} onDelete={mockDelete} />);
      await userEvent.click(screen.getByText(/Delete/));
      expect(mockDelete).toHaveBeenCalledWith("1");
    });
  });

  describe("Mailbox", () => {
    const defaultProps = {
      messages: [],
      recipients: { gm: "Game Master", "1": "Faction One" },
      senderName: "Test Faction",
      myFactionId: 2,
      onSend: jest.fn(),
      onMarkRead: jest.fn(),
      onDelete: jest.fn(),
    };

    test("renders compose button when canCompose=true", () => {
      render(<Mailbox {...defaultProps} canCompose={true} />);
      expect(screen.getByText(/Compose/)).toBeInTheDocument();
    });

    test("hides compose button when canCompose=false", () => {
      render(<Mailbox {...defaultProps} canCompose={false} />);
      expect(screen.queryByText(/Compose/)).not.toBeInTheDocument();
    });

    test("shows unread count badge", () => {
      const messages = [
        { id: "1", read: false, fromFactionName: "Test", createdAt: { toDate: () => new Date() } },
        { id: "2", read: false, fromFactionName: "Test", createdAt: { toDate: () => new Date() } },
        { id: "3", read: true, fromFactionName: "Test", createdAt: { toDate: () => new Date() } },
      ];
      render(<Mailbox {...defaultProps} messages={messages} />);
      expect(screen.getByText("2 new")).toBeInTheDocument();
    });

    test("opens compose modal when compose clicked", async () => {
      render(<Mailbox {...defaultProps} canCompose={true} />);
      await userEvent.click(screen.getByText(/Compose/));
      expect(screen.getByText(/Compose Message/)).toBeInTheDocument();
    });

    test("shows GM-specific labels when isGM=true", () => {
      render(<Mailbox {...defaultProps} isGM={true} canCompose={true} />);
      expect(screen.getByText("Messages from Players")).toBeInTheDocument();
      expect(screen.getByText(/Send Decree/)).toBeInTheDocument();
    });
  });
});